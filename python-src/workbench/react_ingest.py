"""Local dictionary drafts for the React editor; no provider or credential access."""

import json
import re
import sys
from pathlib import Path

from opencc import OpenCC

from .lyric_length import HAN, LATIN, LYRIC_LIMIT, LYRIC_RUN, lyric_count
from .pinyin import normalize
from .songs import HEADING, PUNCTUATION, ROOT, dictionary_entries, project_from_parts

CREDIT = re.compile(
    r"^\s*(唱|演唱|歌手|词|詞|曲|作词|作詞|作曲|编曲|編曲|词曲|詞曲|制作人|製作人|混音|录音|錄音)\s*[:：]\s*(.+)$"
)


def draft_project(
    raw,
    title="",
    artist="",
    dictionary_path=None,
    structure=None,
    *,
    passages=None,
    document=None,
    review=False,
):
    import jieba

    lines = raw.splitlines()
    nonempty = [line.strip() for line in lines if line.strip()]
    skip_title = (
        len(nonempty) > 1
        and CREDIT.match(nonempty[1])
        and not CREDIT.match(nonempty[0])
    )
    if skip_title:
        title = title or nonempty[0]
        nonempty = nonempty[1:]
    for line in nonempty:
        match = CREDIT.match(line)
        if match and match[1] in {"唱", "演唱", "歌手"}:
            artist = artist or match[2].strip()
    # Retain source coordinates through credit removal, splitting and conversion.
    title_line = next((i for i, line in enumerate(lines) if line.strip()), -1)
    converter = OpenCC("t2s")
    rows = []
    parts = []
    for i, line in enumerate(lines):
        line = line.strip()
        if (
            (i == title_line and skip_title)
            or CREDIT.match(line)
            or HEADING.fullmatch(line)
        ):
            continue
        segments = (
            [line]
            if LATIN.search(line)
            else [s.strip() for s in PUNCTUATION.split(line) if s.strip()]
        )
        for j, text in enumerate(segments):
            rows.append({"line": i, "segment": j, "text": text})
            parts.append(converter.convert(text))
    if document is not None:
        if passages is not None or structure is not None or raw:
            raise ValueError("Send one source for the editor document")
        records = document["occurrences"]
        parts = [r["text"] for r in records]
        ids = [r["id"] for r in records]
        if (
            not parts
            or len(set(ids)) != len(ids)
            or any(not isinstance(id_, str) or not id_ for id_ in ids)
            or any(
                not isinstance(text, str)
                or not text.strip()
                or any(c in text for c in "[]\r\n")
                for text in parts
            )
        ):
            raise ValueError("Invalid editor occurrences")
        groups = document["groups"]
        positions = {id_: i for i, id_ in enumerate(ids)}
        previous = -1
        for group in groups:
            members = [positions[id_] for id_ in group["occurrenceIds"]]
            if (
                not members
                or members[0] <= previous
                or members != list(range(members[0], members[-1] + 1))
            ):
                raise ValueError("Invalid editor section")
            previous = members[-1]
        structure = {"groups": groups}
    elif structure is not None and rows != structure["rows"]:
        raise ValueError(
            "Preview no longer matches the source occurrences. Review the lyrics again."
        )
    if passages is not None:
        if not isinstance(passages, list) or any(
            not isinstance(text, str) or not text.strip() for text in passages
        ):
            raise ValueError("Expected nonempty spoken passages")
        parts = [converter.convert(text) for text in passages]
    elif structure and "pieces" in structure:
        pieces = structure["pieces"]
        if any(not isinstance(p, str) or not p.strip() for p in pieces) or "".join(
            pieces
        ) != "".join(r["text"] for r in rows):
            raise ValueError("Phrase boundaries must preserve all source lyrics")
        parts = [converter.convert(p) for p in pieces]
    if (
        not review
        and passages is None
        and any(lyric_count(p) > LYRIC_LIMIT for p in parts)
    ):
        raise ValueError("Review splits for lyrics longer than 11 elements")
    parsed = project_from_parts(parts, title, artist)
    if not parsed.phrases:
        raise ValueError("No lyric lines remain after removing credits/headings")
    path = Path(dictionary_path or ROOT / "public/cedict_1_0_ts_utf-8_mdbg.txt")
    if not path.is_file():
        raise ValueError(
            "CC-CEDICT is missing. Place cedict_1_0_ts_utf-8_mdbg.txt in public/ to create word drafts."
        )
    entries = dictionary_entries(str(path.resolve()), path.stat().st_mtime_ns)

    def lexical(token):
        if converter.convert(token) in entries:
            return [token]
        # Unknown compounds keep coverage without inventing a pronunciation.
        return list(token)

    phrases = []
    for number, phrase in enumerate(parsed.phrases):
        words = []
        english = not HAN.search(phrase.text) and bool(LATIN.search(phrase.text))
        for run in LYRIC_RUN.finditer(phrase.text):
            if not HAN.fullmatch(run.group()):
                if not english:
                    words.append(
                        {
                            "id": f"word-{number}-{len(words)}",
                            "hanzi": "",
                            "pinyin": "",
                            "translation": {"en": run.group()},
                        }
                    )
                continue
            for chinese in jieba.cut(run.group()):
                for token in lexical(chinese):
                    candidates = entries.get(converter.convert(token), [])
                    readings = {}
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
                        if re.search(r"\(idiom\)", match[2], re.IGNORECASE):
                            readings[spelling] = " ".join(supplied)
                        else:
                            readings.setdefault(spelling, spelling)
                    words.append(
                        {
                            "id": f"word-{number}-{len(words)}",
                            "hanzi": token,
                            "pinyin": next(iter(readings.values()))
                            if len(readings) == 1
                            else "",
                            "translation": {"en": ""},
                        }
                    )
        phrases.append(
            {
                "id": f"phrase-{number}",
                "lyricKey": phrase.text,
                "translation": {"en": phrase.text if english else "", "pl": ""},
                "words": words,
                "review": "pending",
                "segmentationApproved": False,
            }
        )
    lookup = {phrase["lyricKey"]: phrase["id"] for phrase in phrases}
    project = {
        "schemaVersion": 1,
        "format": "lyric-workbench",
        "source": "raw-dictionary-draft",
        "metadata": parsed.metadata,
        **(
            {"lyricGroups": structure["groups"]}
            if structure and structure["groups"]
            else {}
        ),
        "phrases": phrases,
        "occurrences": [
            {
                "id": ids[i] if document is not None else f"line-{i}",
                "phraseId": lookup[line.lyricKey],
                "startMs": None,
                "endMs": None,
            }
            for i, line in enumerate(parsed.timeline)
        ],
    }

    if review:
        from .react_dictionary import format_entries

        terms = {}
        source_phrases = structure.get("pieces", parts) if structure else parts
        boundaries = {text: list(jieba.cut(text)) for text in set(source_phrases)}
        for part in set(parts):
            for run in HAN.findall(part):
                for i in range(len(run)):
                    for j in range(i + 1, min(len(run), i + 11) + 1):
                        term = run[i:j]
                        lookup_term = converter.convert(term)
                        if lookup_term in entries and term not in terms:
                            terms[term] = format_entries(term, entries[lookup_term])
        return {"project": project, "terms": terms, "boundaries": boundaries}
    return project


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
                    data.get("raw", ""),
                    data.get("title", ""),
                    data.get("artist", ""),
                    structure=data.get("structure"),
                    review=data.get("review") is True,
                    passages=data.get("dictionaryPassages"),
                    document=data.get("document"),
                ),
                ensure_ascii=False,
            )
        )
    # Report unexpected failures through the worker protocol.
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        sys.exit(1)
