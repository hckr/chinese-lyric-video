"""Preview generation scope without changing the project or contacting a model."""
from typing import TypedDict
from .vocabulary import usable_vocabulary


class GenerationReport(TypedDict):
    model: str
    scope: str
    action: str
    requested: int
    updated: dict[str, list[str]]
    saved: int
    requests: int
    errors: list[str]
    attempts: list[str]
    responses: list[dict]
    path: str


STAGES = ('vocabulary', 'en', 'pl')
LABELS = {'vocabulary': 'Vocabulary and Pinyin', 'en': 'English', 'pl': 'Polish'}


def plan_generation(project, stages, phrase_ids=None, replace=False):
    selected = [p for p in project.phrases if phrase_ids is None or p.id in phrase_ids]
    jobs = {stage: [] for stage in STAGES if stage in stages}
    blocked = {stage: [] for stage in jobs}
    for phrase in selected:
        for stage in jobs:
            missing = not phrase.words if stage == 'vocabulary' else not getattr(phrase.translation, stage).strip()
            if not (replace or missing or getattr(phrase, stage) == 'pending'):
                continue
            vocabulary_ready = usable_vocabulary(phrase)
            if stage != 'vocabulary' and not vocabulary_ready and phrase.id not in jobs.get('vocabulary', []):
                blocked[stage].append(phrase.id)
            else:
                jobs[stage].append(phrase.id)
    return jobs, blocked
