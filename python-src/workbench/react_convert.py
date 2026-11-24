"""Explicit Traditional-to-Simplified conversion for the local lyric editor."""

import json
import sys

from opencc import OpenCC


def convert_lines(lines):
    if (
        not isinstance(lines, list)
        or len(lines) > 10000
        or any(not isinstance(line, str) for line in lines)
    ):
        raise ValueError("Expected up to 10,000 lyric lines")
    converter = OpenCC("t2s")
    return [converter.convert(line) for line in lines]


if __name__ == "__main__":
    try:
        data = json.load(sys.stdin)
        if not isinstance(data, dict):
            raise TypeError("Expected conversion request")
        print(
            json.dumps({"lines": convert_lines(data.get("lines"))}, ensure_ascii=False)
        )
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        sys.exit(1)
