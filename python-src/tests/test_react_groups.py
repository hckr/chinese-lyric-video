import json

import pytest
from workbench.react_groups import GroupRequest, suggest


def test_numbered_repeat_occurrences_sent_to_selected_transport():
    data = GroupRequest(
        provider="Groq",
        model="test",
        structured=True,
        occurrences=["風", "雨", "風", "雨"],
    )

    def transport(prompt, schema):
        assert json.loads(prompt.splitlines()[-1]) == [
            [1, "風"],
            [2, "雨"],
            [3, "風"],
            [4, "雨"],
        ]
        assert set(schema["required"]) == {"groups", "phrases"}
        return '{"groups":[{"name":"Chorus","start":3,"end":4}]}'

    assert suggest(data, transport).groups[0].start == 3


@pytest.mark.parametrize(
    "response",
    [
        "broken",
        '{"groups":[{"name":"A","start":1,"end":3}]}',
        '{"groups":[{"name":"A","start":1,"end":1}]}',
    ],
)
def test_invalid_proposal_rejected(response):
    data = GroupRequest(
        provider="Gemini", model="test", structured=True, occurrences=["風", "雨"]
    )
    with pytest.raises(ValueError):
        suggest(data, lambda *_: response)


def test_phrase_changes_require_exact_coverage():
    request = GroupRequest(
        provider="Groq", model="test", structured=True, occurrences=["甲乙丙丁"]
    )
    valid = '{"groups":[],"phrases":[{"start":1,"end":1,"pieces":["甲乙","丙丁"]}]}'
    assert suggest(request, lambda *_: valid).phrases[0].pieces == ["甲乙", "丙丁"]
    with pytest.raises(ValueError, match="phrase boundaries"):
        suggest(request, lambda *_: valid.replace("丙丁", "丁丙"))


def test_usable_suggestions_survive_invalid_siblings_and_markdown_fences():
    request = GroupRequest(
        provider="Groq", model="test", structured=True, occurrences=["甲乙", "丙丁"]
    )
    response = {
        "groups": [
            {"name": "Opening", "start": 1, "end": 2},
            {"name": "Overlap", "start": 1, "end": 2},
        ],
        "phrases": [{"start": 1, "end": 1, "pieces": ["改"]}],
    }
    result = suggest(request, lambda *_: "```json\n" + json.dumps(response) + "\n```")
    assert [group.name for group in result.groups] == ["Opening"]
    assert result.phrases == []


def test_retry_model_without_response_format_after_http_400(monkeypatch):
    from urllib.error import HTTPError

    from workbench.transport import ConfigurationError

    modes = []

    def provider_transport(request, structured):
        modes.append(structured)

        def complete(prompt, schema):
            if structured:
                raise ConfigurationError("unsupported format") from HTTPError(
                    "", 400, "", {}, None
                )
            return '{"groups":[],"phrases":[]}'

        return complete

    monkeypatch.setattr("workbench.react_groups.provider_transport", provider_transport)
    request = GroupRequest(
        provider="Groq", model="test", structured=True, occurrences=["甲", "乙"]
    )
    assert suggest(request).groups == []
    assert modes == [True, False]


def test_word_advice_accepts_prose_and_rejects_empty_answer():
    from workbench.react_groups import WordRequest

    request = WordRequest(
        provider="Groq",
        model="test",
        structured=True,
        wordContext={"text": "喵喵", "term": "喵", "position": 1},
    )

    def explain(prompt, schema):
        assert json.loads(prompt.splitlines()[-1]) == request.wordContext
        return "喵 imitates a cat's meow."

    assert suggest(request, explain).explanation == "喵 imitates a cat's meow."
    with pytest.raises(ValueError, match="Empty word explanation"):
        suggest(request, lambda *_: " ")
