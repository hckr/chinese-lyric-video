import json
import os
import tempfile
from pathlib import Path
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .pinyin import normalize

class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', validate_assignment=True)

class Translation(Strict):
    en: str = ''
    pl: str = ''

class Gloss(Strict):
    en: str = ''

class Word(Strict):
    hanzi: str = ''
    pinyin: str = ''
    translation: Gloss = Field(default_factory=Gloss)
    @field_validator('pinyin')
    @classmethod
    def valid_pinyin(cls, v): return normalize(v)

State = Literal['pending', 'complete', 'unverified', 'needs_review']
class Phrase(Strict):
    id: str
    text: str
    translation: Translation = Field(default_factory=Translation)
    words: list[Word] = Field(default_factory=list)
    vocabulary: State = 'pending'
    en: State = 'pending'
    pl: State = 'pending'
    provenance: dict = Field(default_factory=dict)
    reference: list[str] = Field(default_factory=list)

class Timing(Strict):
    id: str
    lyricKey: str
    startMs: int = Field(ge=0, strict=True)
    endMs: int = Field(ge=0, strict=True)
    @model_validator(mode='after')
    def ordered(self):
        if self.endMs < self.startMs: raise ValueError('End precedes start')
        return self

class Project(Strict):
    version: Literal[1] = 1
    metadata: dict[str, str] = Field(default_factory=lambda: {'title': '', 'artist': ''})
    phrases: list[Phrase] = Field(default_factory=list)
    timeline: list[Timing] = Field(default_factory=list)
    notes: str = ''
    @model_validator(mode='after')
    def references(self):
        ids = [p.id for p in self.phrases]
        texts = [p.text for p in self.phrases]
        if len(ids) != len(set(ids)) or len(texts) != len(set(texts)): raise ValueError('Duplicate phrase ID or lyric key')
        if len({t.id for t in self.timeline}) != len(self.timeline): raise ValueError('Duplicate timeline ID')
        if any(t.lyricKey not in texts for t in self.timeline): raise ValueError('Unknown timeline lyric key')
        if not all(k in self.metadata for k in ('title', 'artist')): raise ValueError('Title and artist required')
        return self

def save(project, path):
    payload = Project.model_validate_json(project.model_dump_json()).model_dump_json(indent=2)
    path = Path(path)
    if path.suffix.lower() != '.json': raise ValueError('Project saves require a .json path; source songs cannot be overwritten')
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(dir=path.parent, prefix='.project-')
    try:
        with os.fdopen(fd, 'w', encoding='utf8') as f:
            f.write(payload); f.flush(); os.fsync(f.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp): os.unlink(temp)

def load(path): return Project.model_validate_json(Path(path).read_text(encoding='utf8'))
