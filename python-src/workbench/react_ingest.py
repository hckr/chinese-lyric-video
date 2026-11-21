"""Local dictionary drafts for the React editor; no provider or credential access."""

import json
import re
import sys
from pathlib import Path

from .pinyin import normalize
from .songs import ROOT, dictionary_entries, ingest

CREDIT = re.compile(
    r"^\s*(唱|演唱|歌手|词|詞|曲|作词|作詞|作曲|编曲|編曲|词曲|詞曲|制作人|製作人|混音|录音|錄音)\s*[:：]\s*(.+)$"
)
HAN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\U00020000-\U0003134f]+")


def draft_project(raw, title="", artist="", dictionary_path=None):
    import jieba

    lines = raw.splitlines()
    nonempty = [line.strip() for line in lines if line.strip()]
    if (
        len(nonempty) > 1
        and CREDIT.match(nonempty[1])
        and not CREDIT.match(nonempty[0])
    ):
        title = title or nonempty[0]
        nonempty = nonempty[1:]
    for line in nonempty:
        match = CREDIT.match(line)
        if match and match[1] in {"唱", "演唱", "歌手"}:
            artist = artist or match[2].strip()
    cleaned = "\n".join(line for line in nonempty if not CREDIT.match(line))
    parsed = ingest(cleaned, title, artist)
    if not parsed.phrases:
        raise ValueError("No lyric lines remain after removing credits/headings")
    path = Path(dictionary_path or ROOT / "public/cedict_1_0_ts_utf-8_mdbg.txt")
    if not path.is_file():
        raise ValueError(
            "CC-CEDICT is missing. Place cedict_1_0_ts_utf-8_mdbg.txt in public/ to create word drafts."
        )
    entries = dictionary_entries(str(path.resolve()), path.stat().st_mtime_ns)

    def lexical(token):
        if token in entries:
            return [token]
        # Unknown compounds keep coverage without inventing a pronunciation.
        return list(token)

    phrases = []
    for number, phrase in enumerate(parsed.phrases):
        words = []
        for segment in jieba.cut(phrase.text):
            for chinese in HAN.findall(segment):
                for token in lexical(chinese):
                    candidates = entries.get(token, [])
                    readings = set()
                    for entry in candidates:
                        match = re.match(r"\S+ \[(.*?)\] /(.*)/$", entry)
                        if not match:
                            continue
                        reading = normalize(match[1]).lower()
                        supplied = reading.split()
                        spelling = ""
                        for syllable in supplied:
                            if spelling and syllable[0] in "aāáǎàeēéěèoōóǒò":
                                spelling += "'"
                            spelling += syllable
                        readings.add(spelling)
                    words.append(
                        {
                            "id": f"word-{number}-{len(words)}",
                            "hanzi": token,
                            "pinyin": next(iter(readings))
                            if len(readings) == 1
                            else "",
                            "translation": {"en": ""},
                        }
                    )
        phrases.append(
            {
                "id": f"phrase-{number}",
                "lyricKey": phrase.text,
                "translation": {"en": "", "pl": ""},
                "words": words,
                "review": "pending",
                "segmentationApproved": False,
            }
        )
    lookup = {phrase["lyricKey"]: phrase["id"] for phrase in phrases}
    return {
        "schemaVersion": 1,
        "format": "lyric-workbench",
        "source": "raw-dictionary-draft",
        "metadata": parsed.metadata,
        "phrases": phrases,
        "occurrences": [
            {
                "id": f"line-{i}",
                "phraseId": lookup[line.lyricKey],
                "startMs": None,
                "endMs": None,
            }
            for i, line in enumerate(parsed.timeline)
        ],
    }


if __name__ == "__main__":
    try:
        data = json.load(sys.stdin)
        if not isinstance(data, dict) or any(
            not isinstance(data.get(key, ""), str) for key in ("raw", "title", "artist")
        ):
            raise ValueError("Expected raw lyrics, title and artist as strings")
        print(
            json.dumps(
                draft_project(
                    data.get("raw", ""), data.get("title", ""), data.get("artist", "")
                ),
                ensure_ascii=False,
            )
        )
    # Report unexpected failures through the worker protocol.
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        sys.exit(1)
