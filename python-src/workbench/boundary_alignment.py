"""Ordered observation ownership, retaining substitutions rather than trimming edges."""

import itertools
import re

HAN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")
TOKEN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]|[a-zA-Z]+(?:['’][a-zA-Z]+)*")


def units(text):
    return [token.casefold().replace("’", "'") for token in TOKEN.findall(text)]


def assign(expected, observed, equivalent, windows=None, times=None):
    """Global edit alignment. Substitution costs 2; insertion/deletion cost 3.

    Diagonal ties win. Thus a substituted final syllable followed by a
    substituted onset is preferred over borrowing an exact/homophone onset
    into the preceding line and deleting the actual expected onset.
    Returns (expected index, observed index, exact/equivalent flag).
    """
    n, m = len(expected), len(observed)

    def distance_cost(i, j):
        if windows and windows[i]:
            left, right = windows[i]
            if times[j][2] < left - 750 or times[j][1] > right + 750:
                return 1
        return 0

    scores = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        scores[i][0] = 3 * i
    for j in range(m + 1):
        scores[0][j] = 3 * j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            scores[i][j] = min(
                scores[i - 1][j - 1]
                + (0 if equivalent(expected[i - 1], observed[j - 1]) else 2)
                + distance_cost(i - 1, j - 1),
                scores[i - 1][j] + 3,
                scores[i][j - 1] + 3,
            )
    pairs = []
    i, j = n, m
    while i and j:
        equal = equivalent(expected[i - 1], observed[j - 1])
        if scores[i][j] == scores[i - 1][j - 1] + (0 if equal else 2) + distance_cost(
            i - 1, j - 1
        ):
            pairs.append((i - 1, j - 1, equal))
            i, j = i - 1, j - 1
        elif scores[i][j] == scores[i - 1][j] + 3:
            i -= 1
        else:
            j -= 1
    return pairs[::-1]


def assigned_lines(
    cues, transcript, converter, readings, toneless, *, strict_edges=False
):
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

    windows = {c["id"]: c.get("editionWindow") for c in cues}
    pairs = assign(
        [token for _, token in expected],
        [x[0] for x in observed],
        equivalent,
        [windows[id_] for id_, _ in expected] if any(windows.values()) else None,
        observed,
    )
    observed_tokens = [token for token, _, _ in observed]
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
        weak = low_match
        if cue.get("editionWindow"):
            left, right = cue["editionWindow"]
            first = owned[0][2] and owned[0][0] == positions[0]
            last = owned[-1][2] and owned[-1][0] == positions[-1]
            if not first or not last:
                reasons.append(f"LRCLIB source window {left}–{right} ms.")
                for label, supported, edge, key in [
                    ("Start", first, 0, 1),
                    ("End", last, -1, 2),
                ]:
                    reasons.append(
                        f"{label}: Whisper {observed[owned[edge][1]][key]} ms."
                        if supported
                        else f"{label}: needs review."
                    )
                rows.append(row)
                continue
        if strict_edges:
            anchor_tokens = [expected[i][1] for i, _, equal in owned if equal]
            lyric_tokens = [expected[i][1] for i in positions]
            full_edges = (
                owned[0][0] == positions[0]
                and owned[0][2]
                and owned[-1][0] == positions[-1]
                and owned[-1][2]
            )
            mixed = any(HAN.search(token) for token in lyric_tokens)
            if (
                low_match
                or not full_edges
                or (mixed and not any(HAN.search(token) for token in anchor_tokens))
                or not any(token.isascii() for token in anchor_tokens)
            ):
                reasons.append(
                    "Unresolved: English retry requires matched edges and evidence in each lyric language."
                )
                weak = True
            exact_starts = sum(
                observed_tokens[index : index + len(lyric_tokens)] == lyric_tokens
                for index, token in enumerate(observed_tokens)
                if token == lyric_tokens[0]
            )
            if exact_starts > 1 or (
                len(set(lyric_tokens)) == 1
                and (exact_starts != 1 or anchors != len(lyric_tokens))
            ):
                reasons.append(
                    "Unresolved: repeated English observations are ambiguous."
                )
                weak = True
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
            if weak:
                if anchors:
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
