"""Ordered observation ownership, retaining substitutions rather than trimming edges."""

import itertools
import re

TOKEN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]|[a-zA-Z]+")


def units(text):
    return [token.casefold() for token in TOKEN.findall(text)]


def assign(expected, observed, equivalent):
    """Global edit alignment. Substitution costs 2; insertion/deletion cost 3.

    Diagonal ties win. Thus a substituted final syllable followed by a
    substituted onset is preferred over borrowing an exact/homophone onset
    into the preceding line and deleting the actual expected onset.
    Returns (expected index, observed index, exact/equivalent flag).
    """
    n, m = len(expected), len(observed)
    scores = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        scores[i][0] = 3 * i
    for j in range(m + 1):
        scores[0][j] = 3 * j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            scores[i][j] = min(
                scores[i - 1][j - 1]
                + (0 if equivalent(expected[i - 1], observed[j - 1]) else 2),
                scores[i - 1][j] + 3,
                scores[i][j - 1] + 3,
            )
    pairs = []
    i, j = n, m
    while i and j:
        equal = equivalent(expected[i - 1], observed[j - 1])
        if scores[i][j] == scores[i - 1][j - 1] + (0 if equal else 2):
            pairs.append((i - 1, j - 1, equal))
            i, j = i - 1, j - 1
        elif scores[i][j] == scores[i - 1][j] + 3:
            i -= 1
        else:
            j -= 1
    return pairs[::-1]


def assigned_lines(cues, transcript, converter, readings, toneless):
    expected = [
        (cue["id"], token)
        for cue in cues
        for token in units(converter.convert(cue["lyricKey"]))
    ]
    observed = []
    for segment in transcript["segments"]:
        for span in segment.get("words", [segment]):
            for token in units(
                converter.convert(span.get("word", span.get("text", "")))
            ):
                observed.append(
                    (token, round(span["start"] * 1000), round(span["end"] * 1000))
                )

    def equivalent(left, right):
        if left == right or {left, right} == {"oh", "哦"}:
            return True
        return bool(
            {toneless(v) for v in readings.get(left, ())}
            & {toneless(v) for v in readings.get(right, ())}
        )

    pairs = assign(
        [token for _, token in expected], [x[0] for x in observed], equivalent
    )
    rows = []
    for cue in cues:
        positions = [i for i, (id_, _) in enumerate(expected) if id_ == cue["id"]]
        owned = [(i, j, equal) for i, j, equal in pairs if expected[i][0] == cue["id"]]
        anchors = sum(equal for _, _, equal in owned)
        reasons = []
        row = {
            "id": cue["id"],
            "text": cue["lyricKey"],
            "matched": anchors,
            "total": len(positions),
            "reasons": reasons,
            "boundaryMethod": "ordered-edit-alignment-v1",
            "assignedObservedText": "".join(observed[j][0] for _, j, _ in owned),
            "assignment": [
                {
                    "expected": expected[i][1],
                    "observed": observed[j][0],
                    "startMs": observed[j][1],
                    "endMs": observed[j][2],
                    "substitution": not equal,
                }
                for i, j, equal in owned
            ],
        }
        # Keep low-match spans separate from normal proposals; never invent boundaries.
        low_match = anchors < max(1, (len(positions) + 1) // 2)
        if not owned or low_match:
            reasons.append(
                "Unresolved: fewer than half of expected units have matching anchors."
            )
            if not owned:
                rows.append(row)
                continue
        indices = [j for _, j, _ in owned]
        substitutions = sum(not equal for _, _, equal in owned)
        if substitutions:
            reasons.append(
                f"Includes {substitutions} substituted observation(s); audition boundaries."
            )
        if len(owned) < len(positions):
            reasons.append(
                "Some expected units have no observed timestamp; boundary may be incomplete."
            )
        if indices[-1] - indices[0] + 1 > len(indices):
            reasons.append(
                "Extra observations between assigned units; audition for ad-libs."
            )
        if any(
            observed[b][1] - observed[a][2] > 3000
            for a, b in itertools.pairwise(indices)
        ):
            reasons.append(
                "Unresolved: assigned units cross an unverified gap over three seconds."
            )
            rows.append(row)
            continue
        start, end = observed[indices[0]][1], observed[indices[-1]][2]
        if end > start:
            if low_match:
                row["weakEstimate"] = {"startMs": start, "endMs": end}
            else:
                row.update(observedStartMs=start, observedEndMs=end)
        else:
            reasons.append("Unresolved: observed interval has no positive duration.")
        rows.append(row)
    # Shared coarse word/segment spans may belong to adjacent lines: disclose,
    # never interpolate boundaries or silently trim one side.
    for left, right in itertools.pairwise(rows):
        left_end = left.get(
            "observedEndMs", left.get("weakEstimate", {}).get("endMs", -1)
        )
        right_start = right.get(
            "observedStartMs",
            right.get("weakEstimate", {}).get("startMs", float("inf")),
        )
        if left_end > right_start:
            for row in (left, right):
                row["reasons"].append(
                    "Shared/overlapping observation span with adjacent lyric; review required."
                )
    return rows
