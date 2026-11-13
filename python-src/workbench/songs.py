import json
from functools import lru_cache
import re
import subprocess
from pathlib import Path
from opencc import OpenCC
from .models import Project, Phrase, Timing
from .vocabulary import validate_vocabulary

ROOT = Path(__file__).resolve().parents[2]

def import_song(path=None):
    result = subprocess.run(['node', str(ROOT / 'scripts/import-song.cjs'), str(path or ROOT / 'src/Macchiato_Special_Affection_for_You.ts')], capture_output=True, text=True, timeout=20)
    if result.returncode: raise ValueError(result.stderr.strip())
    data = json.loads(result.stdout)
    return Project(metadata=data['metadata'], timeline=data['TIMELINE'], phrases=[Phrase(id=f'p{i:03}', text=text, **entry, vocabulary='unverified', en='unverified', pl='unverified') for i, (text, entry) in enumerate(data['LYRICS_DICT'].items())])

def ingest(raw, title='', artist=''):
    raw = OpenCC('t2s').convert(raw)
    raw = re.sub(r'(?m)^\s*(?:\[[^\]\n]+\]|【[^】\n]+】|(?:Verse|Chorus|Bridge|Intro|Outro)\s*\d*:?|主歌|副歌)\s*$', '', raw, flags=re.I)
    parts = [s.strip() for s in re.split(r'[\n，。！？；,!?;]+', raw) if s.strip()]
    unique = list(dict.fromkeys(parts))
    return Project(metadata={'title': title, 'artist': artist}, phrases=[Phrase(id=f'p{i:03}', text=s) for i, s in enumerate(unique)], timeline=[Timing(id=f'line-{i:03}', lyricKey=s, startMs=0, endMs=0) for i,s in enumerate(parts)])

def warnings(project):
    return [f'{p.text}: incomplete or unverified' for p in project.phrases if any(getattr(p,k) != 'complete' for k in ('vocabulary','en','pl')) or not p.words or not p.translation.en or not p.translation.pl or any(not w.translation.en or (w.hanzi and not w.pinyin) for w in p.words)]

def export_ts(project):
    project = Project.model_validate_json(project.model_dump_json())
    for phrase in project.phrases:
        if phrase.words: validate_vocabulary(phrase.text, phrase.words, require_complete=False)
    dump = lambda x: json.dumps(x, ensure_ascii=False, indent=2)
    lyrics = {p.text: {'translation': p.translation.model_dump(), 'words': [w.model_dump() for w in p.words]} for p in project.phrases}
    return ('const TIMELINE = '+dump([t.model_dump() for t in project.timeline])+' as const;\nconst LYRICS_DICT = '+dump(lyrics)+';\nexport default {\n'+ ',\n'.join(dump(k)+': '+dump(v) for k,v in project.metadata.items())+',\nget lines() { return TIMELINE.map(item => ({id: item.id, startMs: item.startMs, endMs: item.endMs, ...LYRICS_DICT[item.lyricKey]})); }\n};\n')

@lru_cache(maxsize=2)
def dictionary_entries(path, modified_ns):
    entries = {}
    for line in Path(path).read_text(encoding='utf8').splitlines():
        m = re.match(r'\S+ (\S+) \[(.*?)\] /(.*)/', line)
        if m: entries.setdefault(m[1], []).append(f'{m[1]} [{m[2]}] /{m[3]}/')
    return entries


def dictionary(project, path=None):
    import jieba
    path = Path(path or ROOT / 'public/cedict_1_0_ts_utf-8_mdbg.txt')
    entries = dictionary_entries(str(path.resolve()), path.stat().st_mtime_ns)
    for phrase in project.phrases:
        tokens = dict.fromkeys(list(jieba.cut(phrase.text)) + list(phrase.text))
        phrase.reference = [entry for token in tokens for entry in entries.get(token, [])]
