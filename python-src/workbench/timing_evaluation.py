"""Offline exploratory LCS comparison; never applies timings or runs inference.

Input: extracted legacy song JSON and a Whisper JSON transcript. Dictionary
single-character pronunciation alternatives are deliberately permissive, so
Pinyin scores are exploratory upper bounds, not reviewed pronunciation matches.
"""

import argparse
import json
import re
import unicodedata
from pathlib import Path

from opencc import OpenCC

from .boundary_alignment import assigned_lines
from .pinyin import normalize
from .songs import ROOT, dictionary_entries

HANZI = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")


def toneless(value):
    # Remove tone accents only: diaeresis distinguishes ü from u.
    return unicodedata.normalize(
        "NFC",
        "".join(
            c
            for c in unicodedata.normalize("NFD", value)
            if c not in "\u0300\u0301\u0304\u030c"
        ),
    )


def matches(expected, observed):
    """Ordered exact matching with insertions/deletions; deterministic LCS."""
    table = [[0] * (len(observed) + 1) for _ in range(len(expected) + 1)]
    for i, left in enumerate(expected, 1):
        for j, right in enumerate(observed, 1):
            table[i][j] = (
                table[i - 1][j - 1] + 1
                if left & right
                else max(table[i - 1][j], table[i][j - 1])
            )
    pairs = []
    i, j = len(expected), len(observed)
    while i and j:
        if expected[i - 1] & observed[j - 1]:
            pairs.append((i - 1, j - 1))
            i, j = i - 1, j - 1
        elif table[i - 1][j] >= table[i][j - 1]:
            i -= 1
        else:
            j -= 1
    return pairs[::-1]


def evaluate(song, transcript, clip_end_ms):
    converter = OpenCC("t2s")
    path = ROOT / "public/cedict_1_0_ts_utf-8_mdbg.txt"
    entries = dictionary_entries(str(path), path.stat().st_mtime_ns)
    readings = {}
    for char, rows in entries.items():
        if len(char) == 1:
            values = set()
            for row in rows:
                raw = re.search(r"\[(.*?)\]", row)[1]
                if re.fullmatch(r"[A-Za-züÜ:]+[0-5]", raw):
                    values.add(normalize(raw).lower())
            readings[char] = values
    cues = [
        c
        for c in song["TIMELINE"]
        if c.get("startMs") is None or 0 <= c["startMs"] < clip_end_ms
    ]
    expected = [
        (c["id"], char)
        for c in cues
        for char in HANZI.findall(converter.convert(c["lyricKey"]))
    ]
    observed = []
    granularity = set()
    for segment in transcript["segments"]:
        is_word = "words" in segment
        granularity.add("word" if is_word else "segment")
        for span in segment["words"] if is_word else [segment]:
            text = span["word"] if is_word else span["text"]
            for char in HANZI.findall(converter.convert(text)):
                observed.append(
                    (char, round(span["start"] * 1000), round(span["end"] * 1000))
                )
    result = {
        "timestampGranularity": sorted(granularity),
        "caveats": [
            "Dictionary alternatives on both sides; polyphones may inflate matches.",
            "Pinyin modes use dictionary readings, not acoustic tone estimates.",
            "Word/segment spans are shared by their characters; no interpolated boundaries.",
            "Existing song timings are comparison references, not verified vocal boundaries.",
            "LCS has no anchors/confidence and may misassign repeated sections.",
        ],
        "modes": {},
    }

    def tokens(char, mode):
        if mode == "characters":
            return {char}
        values = readings.get(char, set())
        return {toneless(v) for v in values} if mode == "toneless_pinyin" else values

    for mode in ("characters", "pinyin", "toneless_pinyin"):
        pairs = matches(
            [tokens(c, mode) for _, c in expected],
            [tokens(c, mode) for c, _, _ in observed],
        )
        lines = []
        for cue in cues:
            indices = [j for i, j in pairs if expected[i][0] == cue["id"]]
            total = sum(id_ == cue["id"] for id_, _ in expected)
            row = {
                "id": cue["id"],
                "text": cue["lyricKey"],
                "matched": len(indices),
                "total": total,
                "referenceClipped": cue.get("endMs") is not None
                and cue["endMs"] > clip_end_ms,
                "matchedObservedText": "".join(observed[j][0] for j in indices),
            }
            if indices:
                start, end = observed[indices[0]][1], observed[indices[-1]][2]
                row.update(
                    observedStartMs=start,
                    observedEndMs=end,
                )
                if cue.get("startMs") is not None:
                    row["startDeltaMs"] = start - cue["startMs"]
                if cue.get("endMs") is not None:
                    row["endDeltaMs"] = end - cue["endMs"]
            lines.append(row)
        result["modes"][mode] = {
            "matched": len(pairs),
            "expected": len(expected),
            "observed": len(observed),
            "lines": lines,
        }
    assigned = assigned_lines(cues, transcript, converter, readings, toneless)
    result["modes"]["assigned_toneless"] = {
        "matched": sum(r["matched"] for r in assigned),
        "expected": sum(r["total"] for r in assigned),
        "lines": assigned,
        "parameters": {
            "substitutionCost": 2,
            "insertionCost": 3,
            "deletionCost": 3,
            "minimumAnchorFraction": 0.5,
            "maximumUnverifiedGapMs": 3000,
        },
    }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("song", type=Path)
    parser.add_argument("transcript", type=Path)
    parser.add_argument("--clip-end-ms", type=int, required=True)
    args = parser.parse_args()
    print(
        json.dumps(
            evaluate(
                json.loads(args.song.read_text()),
                json.loads(args.transcript.read_text()),
                args.clip_end_ms,
            ),
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
