"""Exact-word dictionary references for on-demand React lookup, without AI calls."""

import json
import re
import sys
from pathlib import Path

from opencc import OpenCC

from .pinyin import normalize
from .songs import ROOT, dictionary_entries


def lookup(term, dictionary_path=None):
    if not isinstance(term, str) or not term.strip() or len(term) > 100:
        raise ValueError("Enter a word of at most 100 characters")
    term = OpenCC("t2s").convert(term.strip())
    path = Path(dictionary_path or ROOT / "public/cedict_1_0_ts_utf-8_mdbg.txt")
    if not path.is_file():
        raise ValueError("Local CC-CEDICT dictionary is missing from public/")
    return format_entries(
        term,
        dictionary_entries(str(path.resolve()), path.stat().st_mtime_ns).get(term, []),
    )


def format_entries(term, entries):
    result = []
    for entry in entries:
        match = re.match(r"\S+ \[(.*?)\] /(.*)/$", entry)
        if match:
            result.append(
                {
                    "hanzi": term,
                    # Reference readings also contain punctuation and literal numerals.
                    "pinyin": re.sub(
                        r"[a-zA-ZüÜ:]+[0-5]",
                        lambda syllable: normalize(syllable[0]),
                        match[1],
                    ).lower(),
                    "meanings": match[2].split("/"),
                }
            )
    return result


if __name__ == "__main__":
    try:
        data = json.load(sys.stdin)
        print(json.dumps(lookup(data.get("term")), ensure_ascii=False))
    # Report unexpected failures through the worker protocol.
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        sys.exit(1)
