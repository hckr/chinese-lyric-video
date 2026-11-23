from workbench.timing_evaluation import matches, toneless


def test_tone_removal_preserves_umlaut_and_neutral_syllables():
    assert toneless("nǚ") == "nü"
    assert toneless("nǚ") != toneless("nǔ")
    assert toneless("liang") == "liang"


def test_alignment_keeps_repeats_ordered_with_extra_and_missing_observations():
    left = [{v} for v in "abcabc"]
    right = [{v} for v in "axbcac"]
    pairs = matches(left, right)
    assert len(pairs) == 5
    assert len({j for _, j in pairs}) == 5
    assert pairs == sorted(pairs)
    assert all(left[i] & right[j] for i, j in pairs)


def test_missing_readings_do_not_match_each_other():
    assert matches([set()], [set()]) == []


def test_real_dictionary_homophones_and_shared_word_spans():
    from workbench.timing_evaluation import evaluate

    song = {
        "TIMELINE": [{"id": "repeat-2", "lyricKey": "你", "startMs": 100, "endMs": 900}]
    }
    transcript = {"segments": [{"words": [{"word": "泥", "start": 0.2, "end": 0.8}]}]}
    result = evaluate(song, transcript, 1000)["modes"]
    assert result["characters"]["matched"] == 0
    assert result["pinyin"]["matched"] == 0
    assert result["toneless_pinyin"]["matched"] == 1
    row = result["toneless_pinyin"]["lines"][0]
    assert row["id"] == "repeat-2"
    assert (row["observedStartMs"], row["observedEndMs"]) == (200, 800)


def test_segment_spans_are_coarse_and_clipped_reference_is_flagged():
    from workbench.timing_evaluation import evaluate

    song = {
        "TIMELINE": [{"id": "a", "lyricKey": "你好", "startMs": 100, "endMs": 1500}]
    }
    transcript = {"segments": [{"text": "你好", "start": 0.2, "end": 1.0}]}
    result = evaluate(song, transcript, 1000)
    assert result["timestampGranularity"] == ["segment"]
    row = result["modes"]["characters"]["lines"][0]
    assert row["referenceClipped"] is True
    assert row["matched"] == 2
    assert (row["observedStartMs"], row["observedEndMs"]) == (200, 1000)


def test_ordered_assignment_keeps_substituted_edges_with_their_own_line():
    from workbench.boundary_alignment import assign

    pairs = assign(
        list("心灵淋雨走"),
        list("心理铃鱼走"),
        lambda a, b: a == b or {a, b} in [{"灵", "铃"}, {"雨", "鱼"}],
    )
    assert [(i, j) for i, j, _ in pairs] == list(enumerate(range(5)))
    assert pairs[1][2] is False and pairs[2][2] is False


def test_assignment_includes_english_vocalization_and_preserves_word_spans():
    from workbench.timing_evaluation import evaluate

    song = {
        "TIMELINE": [{"id": "a", "lyricKey": "Oh~你好", "startMs": 0, "endMs": 4000}]
    }
    transcript = {
        "segments": [
            {
                "words": [
                    {"word": "Oh", "start": 1, "end": 1.5},
                    {"word": "你好", "start": 2, "end": 3},
                ]
            }
        ]
    }
    row = evaluate(song, transcript, 4000)["modes"]["assigned_toneless"]["lines"][0]
    assert (row["observedStartMs"], row["observedEndMs"]) == (1000, 3000)
    assert row["total"] == row["matched"] == 3
    assert row["assignment"][1]["startMs"] == row["assignment"][2]["startMs"] == 2000


def test_assignment_leaves_unsupported_and_missing_lines_unresolved():
    from workbench.timing_evaluation import evaluate

    song = {"TIMELINE": [{"id": "a", "lyricKey": "星星", "startMs": 0, "endMs": 4000}]}
    for transcript in (
        {"segments": []},
        {"segments": [{"words": [{"word": "桌子", "start": 1, "end": 2}]}]},
    ):
        row = evaluate(song, transcript, 4000)["modes"]["assigned_toneless"]["lines"][0]
        assert "observedStartMs" not in row
        assert "Unresolved" in row["reasons"][0]


def test_assignment_preserves_repeats_and_does_not_bridge_instrumental_gap():
    from workbench.timing_evaluation import evaluate

    song = {
        "TIMELINE": [
            {"id": id_, "lyricKey": "你好", "startMs": start, "endMs": start + 2000}
            for id_, start in [("first", 0), ("repeat", 10000)]
        ]
    }
    transcript = {
        "segments": [
            {
                "words": [
                    {"word": "你好", "start": 1, "end": 2},
                    {"word": "你好", "start": 11, "end": 12},
                ]
            }
        ]
    }
    rows = evaluate(song, transcript, 13000)["modes"]["assigned_toneless"]["lines"]
    assert [r["id"] for r in rows] == ["first", "repeat"]
    assert [r["observedStartMs"] for r in rows] == [1000, 11000]
    one_line = {
        "TIMELINE": [{"id": "a", "lyricKey": "你好", "startMs": 0, "endMs": 13000}]
    }
    split = {
        "segments": [
            {
                "words": [
                    {"word": "你", "start": 1, "end": 2},
                    {"word": "好", "start": 11, "end": 12},
                ]
            }
        ]
    }
    row = evaluate(one_line, split, 13000)["modes"]["assigned_toneless"]["lines"][0]
    assert "observedStartMs" not in row
    assert any("gap" in reason for reason in row["reasons"])


def test_assignment_exposes_substituted_end_and_missing_expected_unit():
    from workbench.timing_evaluation import evaluate

    song = {
        "TIMELINE": [{"id": "a", "lyricKey": "你好星", "startMs": 0, "endMs": 4000}]
    }
    observed = {
        "segments": [
            {
                "words": [
                    {"word": "你", "start": 1, "end": 1.3},
                    {"word": "好", "start": 1.3, "end": 1.6},
                    {"word": "桌", "start": 1.6, "end": 2},
                ]
            }
        ]
    }
    row = evaluate(song, observed, 4000)["modes"]["assigned_toneless"]["lines"][0]
    assert row["observedEndMs"] == 2000
    assert row["assignment"][-1]["substitution"]
    assert any("substituted" in reason for reason in row["reasons"])
    observed["segments"][0]["words"].pop()
    row = evaluate(song, observed, 4000)["modes"]["assigned_toneless"]["lines"][0]
    assert row["observedEndMs"] == 1600
    assert any("no observed timestamp" in reason for reason in row["reasons"])


def test_shared_coarse_observation_spans_are_flagged_not_interpolated():
    from workbench.timing_evaluation import evaluate

    song = {
        "TIMELINE": [
            {"id": "a", "lyricKey": "你", "startMs": 0, "endMs": 1000},
            {"id": "b", "lyricKey": "好", "startMs": 1000, "endMs": 2000},
        ]
    }
    transcript = {"segments": [{"text": "你好", "start": 0, "end": 2}]}
    rows = evaluate(song, transcript, 2000)["modes"]["assigned_toneless"]["lines"]
    assert [(r["observedStartMs"], r["observedEndMs"]) for r in rows] == [
        (0, 2000),
        (0, 2000),
    ]
    assert all(any("overlapping" in reason for reason in r["reasons"]) for r in rows)


def test_untimed_song_proposes_bounds_without_fabricated_reference_deltas():
    from workbench.timing_evaluation import evaluate

    song = {
        "TIMELINE": [{"id": "a", "lyricKey": "你好", "startMs": None, "endMs": None}]
    }
    transcript = {"segments": [{"words": [{"word": "你好", "start": 1, "end": 2}]}]}
    result = evaluate(song, transcript, 3000)
    for mode in result["modes"].values():
        row = mode["lines"][0]
        assert (row["observedStartMs"], row["observedEndMs"]) == (1000, 2000)
        assert "startDeltaMs" not in row and "endDeltaMs" not in row
    assert song["TIMELINE"][0]["startMs"] is None


def test_low_anchor_rows_offer_only_contiguous_positive_weak_estimates():
    from workbench.timing_evaluation import evaluate

    song = {
        "TIMELINE": [
            {"id": "weak", "lyricKey": "你好啊", "startMs": None, "endMs": None}
        ]
    }

    def row(words):
        return evaluate(song, {"segments": [{"words": words}]}, 10000)["modes"][
            "assigned_toneless"
        ]["lines"][0]

    weak = row([{"word": "你桌子", "start": 1, "end": 2}])
    assert weak["matched"] == 1 and weak["total"] == 3
    assert weak["weakEstimate"] == {"startMs": 1000, "endMs": 2000}
    assert "observedStartMs" not in weak
    assert "Unresolved" in weak["reasons"][0]
    assert "weakEstimate" not in row([])
    assert "weakEstimate" not in row([{"word": "桌子", "start": 1, "end": 2}])
    assert "weakEstimate" not in row(
        [{"word": "你", "start": 1, "end": 2}, {"word": "桌子", "start": 8, "end": 9}]
    )
    assert "weakEstimate" not in row([{"word": "你桌子", "start": 1, "end": 1}])
