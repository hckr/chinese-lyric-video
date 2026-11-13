from pydantic import Field, field_validator
from .pinyin import normalize
from .models import Strict, Word, Gloss
from .vocabulary import validate_vocabulary, usable_vocabulary
from .prompts import build, VERSION
from .transport import ConfigurationError
from .responses import decode_entries, validation_reason

class GeneratedGloss(Gloss):
    en: str = Field(min_length=1)

class GeneratedWord(Strict):
    hanzi: str
    pinyin: str
    translation: GeneratedGloss
    @field_validator('pinyin')
    @classmethod
    def valid_pinyin(cls, value): return normalize(value)

class VocabularyEntry(Strict):
    id: str
    words: list[GeneratedWord] = Field(min_length=1)

class SentenceEntry(Strict):
    id: str
    text: str = Field(min_length=1)


def generate(project, transport, model, checkpoint=lambda: None, stages=('vocabulary', 'en', 'pl'), batch_size=None, phrase_ids=None, on_event=lambda event: None):
    """Commit entries independently; only pending work is resumed automatically."""
    errors = []
    for stage in stages:
        entry_type = VocabularyEntry if stage == 'vocabulary' else SentenceEntry
        schema = {'type': 'object', 'properties': {'entries': {'type': 'array', 'items': entry_type.model_json_schema()}}, 'required': ['entries']}
        # Resolve local refs at the root for providers that accept JSON Schema.
        defs = schema['properties']['entries']['items'].pop('$defs', None)
        if defs: schema['$defs'] = defs
        pending = [p for p in project.phrases if (phrase_ids is None or p.id in phrase_ids) and getattr(p, stage) == 'pending' and (stage == 'vocabulary' or usable_vocabulary(p))]
        def batch(phrases, corrective=False, previous_errors=''):
            if not phrases: return
            prompt, context = build(project, stage, phrases, 'Fix these errors and supply valid entries for the requested IDs only: ' + previous_errors if corrective else '')
            on_event({'kind': 'request', 'stage': stage, 'count': len(phrases), 'corrective': corrective})
            try:
                raw = transport(prompt, schema)
            except ConfigurationError: raise
            except Exception as exc:
                errors.append(f'{stage}: {exc}'); return
            reasons = {}
            by_id = {}
            try:
                entries = decode_entries(raw)
            except (ValueError, TypeError) as exc:
                entries = []
                reasons = {p.id: str(exc) for p in phrases}
            for entry in entries:
                try:
                    valid = entry_type.model_validate(entry)
                    if stage == 'vocabulary' and isinstance(valid, VocabularyEntry):
                        source = next((p.text for p in phrases if p.id == valid.id), None)
                        if source is not None: validate_vocabulary(source, valid.words)
                    by_id.setdefault(valid.id, []).append(valid)
                except (ValueError, TypeError) as exc:
                    entry_id = entry.get('id') if isinstance(entry, dict) else None
                    if isinstance(entry_id, str): reasons[entry_id] = validation_reason(exc)
                    else:
                        for phrase in phrases: reasons.setdefault(phrase.id, 'Response entry has no valid phrase ID: ' + validation_reason(exc))
            expected_ids = {p.id for p in phrases}
            returned_ids = [str(entry.get('id')) for entry in entries if isinstance(entry, dict)]
            for phrase in phrases:
                count = len(by_id.get(phrase.id, []))
                if count > 1: reasons[phrase.id] = 'Duplicate entries for this phrase ID'
                elif count == 0:
                    reasons.setdefault(phrase.id, 'No valid entry for this phrase ID; returned IDs: ' + (', '.join(returned_ids) or '(none)'))
            on_event({'kind': 'response', 'stage': stage, 'ids': list(expected_ids), 'corrective': corrective,
                      'text': raw, 'metadata': getattr(transport, 'last_response', {}),
                      'errors': {key: value for key, value in reasons.items() if key in expected_ids and len(by_id.get(key, [])) != 1}})
            missing = []
            for p in phrases:
                values = by_id.get(p.id, [])
                if len(values) != 1: missing.append(p); continue
                item = values[0]
                if stage == 'vocabulary':
                    p.words = [Word.model_validate(word.model_dump()) for word in item.words]
                    for lang in ('en', 'pl'):
                        if getattr(p, lang) != 'pending': setattr(p, lang, 'needs_review')
                else: setattr(p.translation, stage, item.text)
                setattr(p, stage, 'complete')
                p.provenance[stage] = {'model': model, 'prompt_version': VERSION, 'notes': project.notes, 'injected_context': context[p.id], 'prompt': prompt}
                on_event({'kind': 'updated', 'stage': stage, 'id': p.id})
                checkpoint()
                on_event({'kind': 'saved', 'stage': stage, 'id': p.id})
            if not missing: return
            correction = '; '.join(p.id + ': ' + reasons.get(p.id, 'Missing valid entry') for p in missing)
            if not corrective: batch(missing, True, correction)
            elif len(missing) > 1:
                middle = len(missing)//2
                batch(missing[:middle], True, correction); batch(missing[middle:], True, correction)
            else: errors.append(f'{stage}/{missing[0].id}: persistent invalid or missing response — {reasons.get(missing[0].id, "Missing valid entry")}')
        size = batch_size or len(pending) or 1
        for offset in range(0, len(pending), size): batch(pending[offset:offset+size])
    return errors
