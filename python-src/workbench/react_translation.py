"""Stream review drafts from the shared Python generation pipeline."""

import json
import sys
from functools import partial
from typing import Literal

from pydantic import Field, ValidationError

from .generation import generate, provider_failure
from .generation_plan import STAGES
from .groq_translation import GroqTransport
from .models import Gloss, Phrase, Project, Strict, Timing, Translation, Word
from .songs import dictionary
from .translation_providers import capabilities
from .transport import ConfigurationError, GeminiTransport
from .vocabulary import usable_vocabulary

Stage = Literal["vocabulary", "en", "pl"]


class AuthoredWord(Strict):
    hanzi: str
    pinyin: str
    translation: Gloss


class Revision(Strict):
    instruction: str = Field(min_length=1, max_length=4000)
    wordIndex: int | None = Field(default=None, ge=0)
    proposedWords: list[AuthoredWord] | None = None


class Lyric(Strict):
    id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    words: list[AuthoredWord]
    translation: Translation


class Request(Strict):
    provider: Literal["Gemini", "Groq"] = "Gemini"
    phrases: list[Lyric]
    timeline: list[Timing]
    jobs: dict[Stage, list[str]]
    model: str = Field(min_length=1, max_length=150)
    thinkingEffort: Literal["none", "low", "medium", "high"] | None = None
    structured: bool
    notes: str = Field(max_length=12000)
    revision: Revision | None = None
    vocabularyMode: Literal["fill", "glosses", "replace"] = "replace"


def run(request, emit, create_transport=None, add_dictionary=dictionary):
    if create_transport is None:
        create_transport = (
            partial(GroqTransport, thinking_effort=request.thinkingEffort)
            if request.provider == "Groq"
            else partial(GeminiTransport, wait_for_recovery=True)
        )
    phrases = {phrase.id: phrase for phrase in request.phrases}
    jobs = {stage: set(ids) for stage, ids in request.jobs.items()}
    if len(phrases) != len(request.phrases) or any(
        not ids <= phrases.keys() for ids in jobs.values()
    ):
        raise ValueError("Translation request contains invalid lyric IDs")
    selected = set().union(*jobs.values())
    if not selected:
        emit({"kind": "done"})
        return
    # React can have distinct lyric IDs with identical text, including after splits.
    project = Project.model_construct(
        phrases=[
            Phrase(
                id=p.id,
                text=p.text,
                words=[
                    Word.model_construct(
                        **word.model_dump(exclude={"translation"}),
                        translation=word.translation,
                    )
                    for word in p.words
                ],
                translation=p.translation.model_copy(),
            )
            for p in phrases.values()
            if p.id in selected
        ],
        timeline=request.timeline,
        notes=request.notes,
    )
    revision = None
    word_index = None
    if request.revision:
        if len(selected) != 1:
            raise ValueError("Select one lyric to revise")
        original = phrases[next(iter(selected))]
        word_index = request.revision.wordIndex
        if word_index is not None and (
            word_index >= len(original.words) or jobs != {"vocabulary": selected}
        ):
            raise ValueError("Select one vocabulary word to revise")
        revision = {
            **request.revision.model_dump(exclude_none=True, exclude={"proposedWords"}),
            "current": original.model_dump(include={"words", "translation"}),
        }
        if request.revision.proposedWords is not None:
            revision["current"]["words"] = [
                word.model_dump() for word in request.revision.proposedWords
            ]
    for phrase in project.phrases:
        for stage in STAGES:
            setattr(
                phrase,
                stage,
                "pending" if phrase.id in jobs.get(stage, ()) else "unverified",
            )
    if jobs.get("vocabulary"):
        try:
            add_dictionary(project)
        except OSError:
            emit(
                {
                    "kind": "notice",
                    "message": "Local CC-CEDICT is unavailable. Vocabulary drafts will lack dictionary evidence.",
                }
            )

    working = {phrase.id: phrase for phrase in project.phrases}

    failures = {}
    terminal = None
    diagnostic = None

    def event(data):
        if data["kind"] == "failure":
            for id in data["ids"]:
                failures[(id, data["stage"])] = data["reason"]

        if data["kind"] in {
            "request",
            "attempt",
            "retry",
            "usage",
            "activity",
            "validating",
            "notice",
            "processing",
        }:
            emit(data)
        if data["kind"] == "response":
            emit({"kind": "response", "text": data["text"]})
        if data["kind"] != "updated":
            return
        stage, phrase = data["stage"], working[data["id"]]
        value = (
            [word.model_dump() for word in phrase.words]
            if stage == "vocabulary"
            else getattr(phrase.translation, stage)
        )
        emit(
            {
                "kind": "draft",
                "id": phrase.id,
                "stage": stage,
                "value": value,
                "support": None
                if stage == "vocabulary"
                else [word.model_dump() for word in phrase.words],
                "dictionary": phrase.reference if stage == "vocabulary" else [],
                "promptVersion": phrase.provenance[stage]["prompt_version"],
            }
        )

    has_work = any(
        jobs.get(stage)
        and (
            stage == "vocabulary"
            or any(usable_vocabulary(working[id]) for id in jobs[stage])
        )
        for stage in STAGES
    )
    if has_work:
        emit({"kind": "provider"})
        try:
            transport = create_transport(
                request.model, request.structured, on_event=event
            )
            batch_size = 4 if request.provider == "Groq" else 12
            run_group = partial(
                generate,
                project,
                transport,
                request.model,
                jobs=jobs,
                revision=revision,
                vocabulary_mode=request.vocabularyMode,
                on_event=event,
                batch_size=batch_size,
            )
            # Finish lyrics with existing vocabulary first, including on resume.
            vocabulary_ids = jobs.get("vocabulary", set())
            ready = [
                p.id
                for p in project.phrases
                if p.id not in vocabulary_ids and usable_vocabulary(p)
            ]
            pending = [p.id for p in project.phrases if p.id in vocabulary_ids]
            for start in range(0, len(ready), batch_size):
                run_group(
                    phrase_ids=set(ready[start : start + batch_size]),
                    stages=("en", "pl"),
                )
            for start in range(0, len(pending), batch_size):
                group = pending[start : start + batch_size]
                run_group(phrase_ids=set(group), stages=("vocabulary",))
                translated = {
                    id for id in group if working[id].vocabulary == "complete"
                }
                run_group(phrase_ids=translated, stages=("en", "pl"))
        except ConfigurationError as error:
            terminal = provider_failure(error)
            diagnostic = getattr(error, "diagnostic", None)

    grouped = {}
    for stage, ids in jobs.items():
        for phrase in project.phrases:
            if phrase.id not in ids or getattr(phrase, stage) != "pending":
                continue
            reason = failures.get((phrase.id, stage))
            if reason is None:
                if stage != "vocabulary" and not usable_vocabulary(phrase):
                    reason = "waiting_for_vocabulary"
                else:
                    reason = "stopped" if terminal else "invalid_response"
            grouped.setdefault((stage, reason), []).append(phrase.id)
    if terminal:
        emit(
            {
                "kind": "issue",
                "reason": terminal,
                **({"diagnostic": diagnostic} if diagnostic else {}),
            }
        )
    for (stage, reason), ids in grouped.items():
        if diagnostic and reason == terminal:
            continue
        emit({"kind": "issue", "stage": stage, "ids": ids, "reason": reason})
    emit({"kind": "done"})


def emit(data):
    print(json.dumps(data, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    if sys.argv[1:] == ["capabilities"]:
        emit(capabilities())
        sys.exit(0)
    try:
        run(Request.model_validate(json.load(sys.stdin)), emit)
    except (ValidationError, ValueError):
        emit(
            {
                "kind": "error",
                "message": "Invalid translation request. Review the selected lyrics and settings.",
            }
        )
    except ConfigurationError:
        emit(
            {
                "kind": "error",
                "message": "Gemini configuration failed. Check GEMINI_API_KEY, model access, and structured JSON settings.",
            }
        )
    # Report unexpected failures through the worker protocol.
    except Exception:  # noqa: BLE001
        emit(
            {
                "kind": "error",
                "message": "Local translation failed. Check the Python environment and try again.",
            }
        )
