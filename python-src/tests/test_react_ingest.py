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
