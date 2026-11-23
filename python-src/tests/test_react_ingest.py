from pathlib import Path

import pytest
from workbench.react_ingest import draft_project


@pytest.fixture
def dictionary(tmp_path):
    path = tmp_path / "cedict.txt"
    path.write_text(
        "漂亮 漂亮 [piao4 liang5] /beautiful/pretty/\n"
        "的 的 [de5] /possessive particle/\n"
        "貓 猫 [mao1] /cat/\n"
        "做 做 [zuo4] /to do/to become/\n"
        "你 你 [ni3] /you/\n"
        "喵 喵 [miao1] /meow/\n"
        "女兒 女儿 [nu:3 er2] /daughter/\n"
        "行 行 [xing2] /to walk/\n"
        "行 行 [hang2] /row/\n",
        encoding="utf8",
    )
    return path


def test_credits_title_repetitions_and_word_drafts(dictionary):
    project = draft_project(
        "纸上练习\n唱：测试歌手\n词：测试作者\n曲：测试作者\n女儿的猫\n漂亮的猫\n女儿的猫",
        dictionary_path=dictionary,
    )
    assert project["metadata"] == {"title": "纸上练习", "artist": "测试歌手"}
    assert len(project["phrases"]) == 2
    assert len(project["occurrences"]) == 3
    assert (
        project["occurrences"][0]["phraseId"] == project["occurrences"][2]["phraseId"]
    )
    assert all(
        o["startMs"] is None and o["endMs"] is None for o in project["occurrences"]
    )
    phrase = project["phrases"][1]
    assert [w["hanzi"] for w in phrase["words"]] == ["漂亮", "的", "猫"]
    assert phrase["words"][0]["pinyin"] == "piàoliang"
    assert phrase["words"][1]["pinyin"] == "de"
    assert phrase["translation"] == {"en": "", "pl": ""}
    assert all(word["translation"] == {"en": ""} for word in phrase["words"])
    assert "dictionaryEntries" not in phrase
    assert phrase["review"] == "pending"
    assert not phrase["segmentationApproved"]


def test_ambiguous_readings_unknown_words_and_apostrophes(dictionary):
    project = draft_project("女儿\n行\n龘", dictionary_path=dictionary)
    assert project["phrases"][0]["words"][0]["pinyin"] == "nǚ'ér"
    assert project["phrases"][1]["words"][0]["pinyin"] == ""
    assert project["phrases"][2]["words"][0]["hanzi"] == "龘"
    assert project["phrases"][2]["words"][0]["pinyin"] == ""


def test_explicit_metadata_and_simplification(dictionary):
    project = draft_project("唱：someone\n漂亮的貓", "Explicit", "Artist", dictionary)
    assert project["metadata"] == {"title": "Explicit", "artist": "Artist"}
    assert project["phrases"][0]["lyricKey"] == "漂亮的猫"


def test_missing_dictionary_and_empty_lyrics(dictionary):
    with pytest.raises(ValueError, match="CC-CEDICT"):
        draft_project("你好", dictionary_path=Path("/missing/cedict.txt"))
    with pytest.raises(ValueError, match="No lyric"):
        draft_project("唱：someone", dictionary_path=dictionary)


def test_on_demand_dictionary(dictionary):
    from workbench.react_dictionary import lookup

    assert lookup("貓", dictionary) == [
        {"hanzi": "猫", "pinyin": "māo", "meanings": ["cat"]}
    ]
    assert len(lookup("行", dictionary)) == 2
    assert lookup("不存在", dictionary) == []
    with pytest.raises(ValueError):
        lookup("", dictionary)


@pytest.mark.parametrize("label", ["詞", "作詞", "編曲", "詞曲", "製作人", "錄音"])
def test_traditional_credits_are_not_lyrics(dictionary, label):
    project = draft_project(
        f"紙上練習\n唱：測試歌手\n{label}：測試作者\n曲：測試作者\n女兒的貓",
        dictionary_path=dictionary,
    )
    assert len(project["phrases"]) == 1
    assert project["phrases"][0]["lyricKey"] == "女儿的猫"
    assert len(project["occurrences"]) == 1
    assert project["metadata"]["title"] == "紙上練習"
    assert project["metadata"]["artist"] == "測試歌手"


@pytest.mark.parametrize(
    "term, reading, expected",
    [
        ("阿尔法·罗密欧", "A1 er3 fa3 · Luo2 mi4 ou1", "ā ěr fǎ · luó mì ōu"),
        ("21三体综合症", "21 san1 ti3 zong1 he2 zheng4", "21 sān tǐ zōng hé zhèng"),
        ("一不做，二不休", "yi1 bu4 zuo4 , er4 bu4 xiu1", "yī bù zuò , èr bù xiū"),
    ],
)
def test_dictionary_readings_preserve_reference_notation(
    dictionary, term, reading, expected
):
    from workbench.react_dictionary import lookup

    with dictionary.open("a", encoding="utf8") as stream:
        stream.write(f"{term} {term} [{reading}] /reference meaning/\n")
    result = lookup(term, dictionary)
    assert result == [
        {"hanzi": term, "pinyin": expected, "meanings": ["reference meaning"]}
    ]


def test_reviewed_structure_checks_source_before_attaching_groups(dictionary):
    raw = "標題\n詞：作者\n[Chorus]\n女兒，貓\n[Chorus]\n女兒，貓"
    structure = {
        "rows": [
            {"line": line, "segment": segment, "text": text}
            for line in (3, 5)
            for segment, text in enumerate(("女兒", "貓"))
        ],
        "groups": [
            {"id": "a", "name": "Chorus", "occurrenceIds": ["line-0", "line-1"]},
            {"id": "b", "name": "Chorus", "occurrenceIds": ["line-2", "line-3"]},
        ],
    }
    result = draft_project(raw, dictionary_path=dictionary, structure=structure)
    assert result["lyricGroups"] == structure["groups"]
    assert result["phrases"][0]["lyricKey"] == "女儿"
    assert result["occurrences"][0]["phraseId"] == result["occurrences"][2]["phraseId"]
    structure["rows"][2]["line"] = 3
    with pytest.raises(ValueError, match="Preview"):
        draft_project(raw, dictionary_path=dictionary, structure=structure)


def test_new_lyric_limit_preserves_raw_source_across_reviewed_boundaries(dictionary):
    short = "字" * 9 + "，中３"
    project = draft_project(short, dictionary_path=dictionary)
    assert len(project["occurrences"]) == 2
    long = "字" * 10 + " 中３！"
    with pytest.raises(ValueError, match="11 elements"):
        draft_project(long, dictionary_path=dictionary)
    source = long[:-1]
    structure = {
        "rows": [{"line": 0, "segment": 0, "text": source}],
        "pieces": [source[:-2], source[-2:]],
        "groups": [],
    }
    assert (
        len(
            draft_project(long, dictionary_path=dictionary, structure=structure)[
                "occurrences"
            ]
        )
        == 2
    )
    structure["pieces"][0] = "changed"
    with pytest.raises(ValueError, match="preserve"):
        draft_project(long, dictionary_path=dictionary, structure=structure)


def test_editor_document_preserves_spelling_spacing_and_occurrence_identity(dictionary):
    occurrences = [
        {"id": "first", "text": "  女兒，貓  "},
        {"id": "second", "text": "  女兒，貓  "},
        {"id": "credit", "text": "唱：歌手"},
    ]
    groups = [{"id": "section", "name": "Intro", "occurrenceIds": ["first"]}]
    doc = {"occurrences": occurrences, "groups": groups}
    project = draft_project("", document=doc, dictionary_path=dictionary)
    assert project["lyricGroups"] == groups
    assert [o["id"] for o in project["occurrences"]] == ["first", "second", "credit"]
    assert [p["lyricKey"] for p in project["phrases"]] == ["  女兒，貓  ", "唱：歌手"]
    assert "".join(w["hanzi"] for w in project["phrases"][0]["words"]) == "女兒貓"
    occurrences[0]["text"] = "字" * 12
    with pytest.raises(ValueError, match="11 elements"):
        draft_project("", document=doc, dictionary_path=dictionary)


def test_sung_english_and_mixed_lyrics(dictionary):
    english = "Don't forget this entire English lyric even when it opens the song."
    mixed = "我 don’t love 你"
    lines = [english, mixed, english, "字" * 9 + " love you"]
    doc = {
        "occurrences": [{"id": str(i), "text": t} for i, t in enumerate(lines)],
        "groups": [],
    }
    project = draft_project("", document=doc, dictionary_path=dictionary)
    first, second, _ = project["phrases"]
    assert first["translation"]["en"] == english
    assert first["words"] == []
    assert [o["id"] for o in project["occurrences"]] == ["0", "1", "2", "3"]
    assert (
        project["occurrences"][0]["phraseId"] == project["occurrences"][2]["phraseId"]
    )
    assert [(w["hanzi"], w["translation"]["en"]) for w in second["words"]] == [
        ("我", ""),
        ("", "don’t"),
        ("", "love"),
        ("你", ""),
    ]
    assert all(not w["pinyin"] for w in second["words"] if not w["hanzi"])
    doc["occurrences"][-1]["text"] += " too"
    with pytest.raises(ValueError, match="11"):
        draft_project("", document=doc, dictionary_path=dictionary)


def test_import_preserves_dictionary_spacing_for_tagged_idioms(dictionary, monkeypatch):
    import jieba

    monkeypatch.setattr(jieba, "cut", lambda text: [text])
    with dictionary.open("a", encoding="utf8") as stream:
        stream.write(
            "一了百了 一了百了 [yi1 liao3 bai3 liao3] /once and for all (idiom)/\n"
        )
        stream.write("一了百了 一了百了 [yi1 liao3 bai3 liao3] /an additional gloss/\n")
        stream.write("喜歡 喜欢 [xi3 huan5] /to like/\n")

    project = draft_project("一了百了\n喜欢", dictionary_path=dictionary)
    assert [phrase["words"][0]["pinyin"] for phrase in project["phrases"]] == [
        "yī liǎo bǎi liǎo",
        "xǐhuan",
    ]
