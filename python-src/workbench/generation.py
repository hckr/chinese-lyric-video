import re

from httpx2 import TimeoutException
from pydantic import Field, field_validator

from .groq_translation import GroqTransport
from .models import Gloss, Strict, Word
from .pinyin import normalize
from .prompts import VERSION, build
from .responses import decode_entries, validation_reason
from .transport import (
    ConfigurationError,
    GeminiTransport,
    ReduceBatch,
    quota_reason,
    status_code,
)
from .vocabulary import usable_vocabulary, validate_vocabulary


class GeneratedGloss(Gloss):
    en: str = Field(min_length=1)


class GeneratedWord(Strict):
    hanzi: str
    pinyin: str
    translation: GeneratedGloss

    @field_validator("pinyin")
    @classmethod
    def valid_pinyin(cls, value):
        return normalize(value)


class VocabularyEntry(Strict):
    id: str
    words: list[GeneratedWord] = Field(min_length=1)


class SentenceEntry(Strict):
    id: str
    text: str = Field(min_length=1)


def provider_failure(error):
    """Return only recognized status and exception categories to the worker."""
    code = status_code(error) or status_code(error.__cause__)
    if code in (401, 403):
        return "access"
    if code == 404:
        return "model"
    if code == 413:
        return "oversized"
    if code == 400:
        return "request"
    if code == 429:
        source = error if status_code(error) == 429 else error.__cause__
        return getattr(source, "quota_reason", None) or quota_reason(source)
    if (
        code in (408, 504)
        or isinstance(error, (TimeoutError, TimeoutException))
        or isinstance(error.__cause__, (TimeoutError, TimeoutException))
    ):
        return "timeout"
    if code is not None and 500 <= code < 600:
        return "unavailable"
    if isinstance(error, ConfigurationError):
        return "configuration"
    return "connection"


def generate(
    project,
    transport,
    model,
    checkpoint=lambda: None,
    stages=("vocabulary", "en", "pl"),
    batch_size=None,
    phrase_ids=None,
    on_event=lambda event: None,
    jobs=None,
    revision=None,
    vocabulary_mode="replace",
):
    """Commit entries independently; only pending work is resumed automatically."""
    errors = []

    def generate_stage(stage):
        entry_type = VocabularyEntry if stage == "vocabulary" else SentenceEntry
        schema = {
            "type": "object",
            "properties": {
                "entries": {"type": "array", "items": entry_type.model_json_schema()}
            },
            "required": ["entries"],
        }
        # Resolve local refs at the root for providers that accept JSON Schema.
        defs = schema["properties"]["entries"]["items"].pop("$defs", None)
        if defs:
            schema["$defs"] = defs
        pending = [
            p
            for p in project.phrases
            if (phrase_ids is None or p.id in phrase_ids)
            and (jobs is None or p.id in jobs.get(stage, ()))
            and getattr(p, stage) == "pending"
            and (stage == "vocabulary" or usable_vocabulary(p))
        ]

        def batch(phrases, corrective=False, previous_errors=""):
            if not phrases:
                return
            prompt, context = build(
                project,
                stage,
                phrases,
                "Fix these errors and supply valid entries for the requested IDs only: "
                + previous_errors
                if corrective
                else "",
                revision,
                include_current=jobs is not None,
                vocabulary_mode=vocabulary_mode,
            )
            on_event(
                {
                    "kind": "request",
                    "stage": stage,
                    "count": len(phrases),
                    "corrective": corrective,
                    "prompt": prompt,
                }
            )
            try:
                if isinstance(transport, (GeminiTransport, GroqTransport)):
                    transport.can_split = len(phrases) > 1
                raw = transport(prompt, schema)
                on_event({"kind": "processing"})
            except Exception as exc:
                if (isinstance(exc, ReduceBatch) or status_code(exc) == 413) and len(
                    phrases
                ) > 1:
                    on_event(
                        {
                            "kind": "notice",
                            "message": f"The worker is retrying {len(phrases)} lyrics in smaller groups.",
                        }
                    )
                    mid = len(phrases) // 2
                    batch(phrases[:mid], corrective, previous_errors)
                    batch(phrases[mid:], corrective, previous_errors)
                    return
                on_event(
                    {
                        "kind": "failure",
                        "stage": stage,
                        "ids": [p.id for p in phrases],
                        "reason": provider_failure(exc),
                    }
                )
                if isinstance(exc, ConfigurationError):
                    raise
                errors.append(f"{stage}: {exc}")
                return
            reasons = {}
            by_id = {}
            invalid_envelope = False
            try:
                entries = decode_entries(raw)
            except (ValueError, TypeError) as exc:
                invalid_envelope = True
                entries = []
                reasons = {p.id: str(exc) for p in phrases}
            on_event({"kind": "validating"})
            for entry in entries:
                try:
                    valid = entry_type.model_validate(entry)
                    if stage == "vocabulary" and isinstance(valid, VocabularyEntry):
                        source = next((p for p in phrases if p.id == valid.id), None)
                        if source is not None:
                            word_index = revision.get("wordIndex") if revision else None
                            if word_index is None:
                                if source.words and vocabulary_mode != "replace":
                                    if [word.hanzi for word in valid.words] != [
                                        word.hanzi for word in source.words
                                    ]:
                                        raise ValueError(
                                            "Keep the current Hanzi rows and word boundaries"
                                        )
                                    valid = valid.model_copy(
                                        update={
                                            "words": [
                                                proposed.model_copy(
                                                    update={
                                                        "pinyin": current.pinyin
                                                        if current.pinyin.strip()
                                                        else proposed.pinyin,
                                                        "translation": current.translation
                                                        if vocabulary_mode == "fill"
                                                        and current.translation.en.strip()
                                                        else proposed.translation,
                                                    }
                                                )
                                                for current, proposed in zip(
                                                    source.words, valid.words
                                                )
                                            ],
                                        }
                                    )
                                validate_vocabulary(source.text, valid.words)
                            else:
                                original_hanzi = source.words[word_index].hanzi
                                if (
                                    len(valid.words) != 1
                                    or valid.words[0].hanzi != original_hanzi
                                ):
                                    raise ValueError(
                                        "Return only the selected word and preserve its Hanzi"
                                    )
                                validate_vocabulary(original_hanzi, valid.words)
                    if stage != "vocabulary" and not valid.text.strip():
                        raise ValueError("Sentence is blank")
                    if stage != "vocabulary" and re.search(
                        r"\([^()]*:[^()]*;[^()]*:[^()]*\)|\[[^\]]*[āǎēěīǐōǒūǔǖǘǚǜ][^\]]*\]",
                        valid.text,
                        re.IGNORECASE,
                    ):
                        raise ValueError(
                            "Return the translated lyric alone, without Pinyin or glossary"
                        )
                    by_id.setdefault(valid.id, []).append(valid)
                except (ValueError, TypeError) as exc:
                    entry_id = entry.get("id") if isinstance(entry, dict) else None
                    if isinstance(entry_id, str):
                        reasons[entry_id] = validation_reason(exc)
                    else:
                        for phrase in phrases:
                            reasons.setdefault(
                                phrase.id,
                                "Response entry has no valid phrase ID: "
                                + validation_reason(exc),
                            )
            expected_ids = {p.id for p in phrases}
            returned_ids = [
                str(entry.get("id")) for entry in entries if isinstance(entry, dict)
            ]
            for phrase in phrases:
                count = len(by_id.get(phrase.id, []))
                if count > 1:
                    reasons[phrase.id] = "Duplicate entries for this phrase ID"
                elif count == 0:
                    reasons.setdefault(
                        phrase.id,
                        "No valid entry for this phrase ID; returned IDs: "
                        + (", ".join(returned_ids) or "(none)"),
                    )
            on_event(
                {
                    "kind": "response",
                    "stage": stage,
                    "ids": list(expected_ids),
                    "corrective": corrective,
                    "text": raw,
                    "metadata": getattr(transport, "last_response", {}),
                    "errors": {
                        key: value
                        for key, value in reasons.items()
                        if key in expected_ids and len(by_id.get(key, [])) != 1
                    },
                }
            )
            missing = []
            for p in phrases:
                values = by_id.get(p.id, [])
                if len(values) != 1:
                    missing.append(p)
                    continue
                item = values[0]
                if stage == "vocabulary":
                    p.words = [
                        Word.model_construct(
                            **word.model_dump(exclude={"translation"}),
                            translation=word.translation,
                        )
                        for word in item.words
                    ]
                    for lang in ("en", "pl"):
                        if jobs is None and getattr(p, lang) != "pending":
                            setattr(p, lang, "needs_review")
                else:
                    setattr(p.translation, stage, item.text)
                setattr(p, stage, "complete")
                p.provenance[stage] = {
                    "model": model,
                    "prompt_version": VERSION,
                    "notes": project.notes,
                    "injected_context": context[p.id],
                    "prompt": prompt,
                }
                on_event({"kind": "updated", "stage": stage, "id": p.id})
                checkpoint()
                on_event({"kind": "saved", "stage": stage, "id": p.id})
            if not missing:
                return
            metadata = getattr(transport, "last_response", {})
            finish = [
                str(value).rsplit(".", 1)[-1]
                for value in metadata.get("finish_reasons", [])
            ]
            truncated = "MAX_TOKENS" in finish or "length" in finish
            correction = "; ".join(
                p.id + ": " + reasons.get(p.id, "Missing valid entry") for p in missing
            )
            split = len(missing) > 1 and (truncated or corrective)
            if split or not corrective:
                cause = (
                    "The model reached its output limit"
                    if truncated
                    else "The response was not valid JSON"
                    if invalid_envelope
                    else "Some lyrics did not have valid drafts"
                )
                action = (
                    "retrying in smaller groups" if split else "requesting a correction"
                )
                on_event(
                    {
                        "kind": "notice",
                        "message": f"{cause} for {len(missing)} lyrics. The worker is {action}.",
                    }
                )
            if split:
                middle = len(missing) // 2
                batch(missing[:middle], True, "" if truncated else correction)
                batch(missing[middle:], True, "" if truncated else correction)
            elif not corrective:
                batch(missing, True, correction)
            else:
                reason = "invalid_response"
                if truncated:
                    reason = "output_limit"
                elif str(metadata.get("block_reason") or "").rsplit(".", 1)[-1] not in (
                    "",
                    "0",
                    "BLOCKED_REASON_UNSPECIFIED",
                ) or any(
                    value in {"SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "RECITATION"}
                    for value in finish
                ):
                    reason = "blocked_response"
                elif not isinstance(raw, str) or not raw.strip():
                    reason = "empty_response"
                elif reasons.get(missing[0].id, "").startswith(
                    "Return the translated lyric alone"
                ):
                    reason = "sentence_annotations"
                elif invalid_envelope:
                    reason = "response_format"
                elif reasons.get(missing[0].id, "").startswith(
                    "Keep the current Hanzi"
                ):
                    reason = "word_boundaries"
                on_event(
                    {
                        "kind": "failure",
                        "stage": stage,
                        "ids": [missing[0].id],
                        "reason": reason,
                    }
                )
                errors.append(
                    f"{stage}/{missing[0].id}: persistent invalid or missing response — {reasons.get(missing[0].id, 'Missing valid entry')}"
                )

        size = batch_size or len(pending) or 1
        for offset in range(0, len(pending), size):
            batch(pending[offset : offset + size])

    for stage in stages:
        generate_stage(stage)
    return errors
