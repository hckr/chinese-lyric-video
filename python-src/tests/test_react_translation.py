import json
from types import SimpleNamespace

from workbench import config
from workbench.react_translation import Request, run
from workbench.translation_providers import TRANSLATION_MODELS, capabilities
from workbench.transport import GenerationServiceError


def request(jobs, revision=None, words=None):
    return Request.model_validate(
        {
            "model": "fake-model",
            "structured": False,
            "notes": "Narrator is reflecting",
            "phrases": [
                {
                    "id": "idiom",
                    "text": "一丝一毫",
                    "words": words or [],
                    "translation": {"en": "", "pl": ""},
                }
            ],
            "timeline": [
                {"id": id, "lyricKey": "一丝一毫", "startMs": 0, "endMs": 0}
                for id in ("first", "repeat")
            ],
            "jobs": jobs,
            "revision": revision,
        }
    )


IDIOM = {
    "hanzi": "一丝一毫",
    "pinyin": "yī sī yī háo",
    "translation": {"en": "the slightest bit"},
}


def test_empty_request_never_creates_transport():
    def unexpected(*args, **kwargs):
        raise AssertionError("unexpected provider or dictionary call")

    events = []
    run(request({}), events.append, unexpected, unexpected)
    assert events == [{"kind": "done"}]


def test_repeated_context_corrective_response_and_partial_results():
    seen = []
    events = []

    def create(model, structured, on_event):
        assert model == "fake-model"
        assert not structured

        def transport(prompt, schema):
            policy, data = prompt.rsplit("\n", 1)
            data = json.loads(data)
            seen.append(data)
            assert "prompt_version" not in data
            assert data["song_order"] == ["一丝一毫"] * 2
            assert data["notes"] == "Narrator is reflecting"
            assert [entry["id"] for entry in data["requested"]] == ["idiom"]
            assert "entries" in schema["properties"]
            if data["stage"] == "vocabulary":
                assert "literal image" in policy and "figurative meaning" in policy
                assert data["supporting_context"]["idiom"]["dictionary_reference"] == [
                    "dictionary evidence"
                ]
                word = IDIOM if data["correction"] else {**IDIOM, "pinyin": "pinyin"}
                return {"entries": [{"id": "idiom", "words": [word]}]}
            assert "translate its intended meaning" in policy
            assert data["supporting_context"]["idiom"] == [IDIOM]
            if data["stage"] == "pl":
                assert "Polish must translate directly from Chinese" in policy
                return {"entries": []}
            return {"entries": [{"id": "idiom", "text": "The slightest bit."}]}

        return lambda prompt, schema: json.dumps(transport(prompt, schema))

    def dictionary(project):
        project.phrases[0].reference = ["dictionary evidence"]

    run(
        request({stage: ["idiom"] for stage in ("vocabulary", "en", "pl")}),
        events.append,
        create,
        dictionary,
    )
    drafts = [event for event in events if event["kind"] == "draft"]
    assert [event["stage"] for event in drafts] == ["vocabulary", "en"]
    assert drafts[0]["value"] == [IDIOM]
    assert drafts[0]["dictionary"] == ["dictionary evidence"]
    assert drafts[1]["support"] == [IDIOM]
    assert [data["stage"] for data in seen] == [
        "vocabulary",
        "vocabulary",
        "en",
        "pl",
        "pl",
    ]
    assert any(
        event["kind"] == "issue"
        and event["stage"] == "pl"
        and event["reason"] == "invalid_response"
        for event in events
    )
    assert events[-1] == {"kind": "done"}


def test_word_revision_retries_boundary_change():
    events = []
    revision = {"instruction": "Use a more literal gloss", "wordIndex": 0}
    revised = {**IDIOM, "translation": {"en": "an insignificant amount"}}

    def create(*args, **kwargs):
        def transport(prompt, schema):
            data = json.loads(prompt.rsplit("\n", 1)[1])
            assert data["revision"]["current"]["words"] == [IDIOM, sibling]
            words = (
                [revised]
                if data["correction"]
                else [
                    {
                        "hanzi": "一丝",
                        "pinyin": "yī sī",
                        "translation": {"en": "a thread"},
                    },
                    {
                        "hanzi": "一毫",
                        "pinyin": "yī háo",
                        "translation": {"en": "a small amount"},
                    },
                ]
            )
            return json.dumps({"entries": [{"id": "idiom", "words": words}]})

        return transport

    sibling = {"hanzi": "好", "pinyin": "", "translation": {"en": ""}}
    partial = request({"vocabulary": ["idiom"]}, revision, [IDIOM, sibling])
    partial.phrases[0].text += "好"
    run(
        partial,
        events.append,
        create,
        lambda _: None,
    )
    assert [event["value"] for event in events if event["kind"] == "draft"] == [
        [revised]
    ]


def test_fill_preserves_existing_readings_and_glosses_and_supports_sentences():
    authored = {"hanzi": "一丝", "pinyin": "yī sī", "translation": {"en": "one thread"}}
    incomplete = {"hanzi": "一毫", "pinyin": "", "translation": {"en": ""}}
    completed = {
        "hanzi": "一毫",
        "pinyin": "yī háo",
        "translation": {"en": "a tiny amount"},
    }
    payload = request(
        {"vocabulary": ["idiom"], "pl": ["idiom"]}, words=[authored, incomplete]
    )
    payload.vocabularyMode = "fill"
    events = []

    def create(*args, **kwargs):
        def transport(prompt, schema):
            _instructions, raw = prompt.rsplit("\n", 1)
            data = json.loads(raw)
            if data["stage"] == "pl":
                assert data["supporting_context"]["idiom"] == [authored, completed]
                result = {"text": "Ani odrobiny."}
            elif not data["correction"]:
                assert "keep every row" in data["request_instructions"]
                result = {"words": [IDIOM]}
            else:
                result = {
                    "words": [
                        {
                            **authored,
                            "pinyin": "yīsī",
                            "translation": {"en": "changed"},
                        },
                        completed,
                    ]
                }
            return json.dumps({"entries": [{"id": "idiom", **result}]})

        return transport

    run(payload, events.append, create, lambda _: None)
    assert [event["value"] for event in events if event["kind"] == "draft"] == [
        [authored, completed],
        "Ani odrobiny.",
    ]


def test_partial_song_reports_batch_failures_and_resumes_only_unfinished_work():
    ids = [f"lyric-{index}" for index in range(22)]
    payload = request({}).model_dump()
    payload["phrases"] = [{**payload["phrases"][0], "id": id} for id in ids]
    payload["jobs"] = {stage: ids for stage in ("vocabulary", "en", "pl")}

    attempts = []
    retrying = False

    def create(*args, **kwargs):
        def transport(prompt, schema):
            data = json.loads(prompt.rsplit("\n", 1)[1])
            stage = data["stage"]
            requested = [entry["id"] for entry in data["requested"]]
            attempts.append((stage, requested))
            if not retrying:
                if stage == "vocabulary" and requested == ids[12:]:
                    raise TimeoutError("secret provider timeout details")
                if stage != "vocabulary":
                    cause = RuntimeError("secret provider JSON")
                    cause.response = SimpleNamespace(status_code=429)
                    raise GenerationServiceError("secret API URL") from cause
            return json.dumps(
                {
                    "entries": [
                        {
                            "id": id,
                            **(
                                {"words": [IDIOM]}
                                if stage == "vocabulary"
                                else {"text": "A tiny bit."}
                            ),
                        }
                        for id in requested
                    ]
                }
            )

        return transport

    first = []
    run(Request.model_validate(payload), first.append, create, lambda _: None)
    assert attempts == [
        ("vocabulary", ids[:12]),
        ("en", ids[:12]),
        ("pl", ids[:12]),
        ("vocabulary", ids[12:]),
    ]
    drafts = [event for event in first if event["kind"] == "draft"]
    assert [event["id"] for event in drafts] == ids[:12]
    issues = [event for event in first if event["kind"] == "issue"]
    assert {(event["stage"], event["reason"]): event["ids"] for event in issues} == {
        ("vocabulary", "timeout"): ids[12:],
        ("en", "rate_limit"): ids[:12],
        ("pl", "rate_limit"): ids[:12],
        ("en", "waiting_for_vocabulary"): ids[12:],
        ("pl", "waiting_for_vocabulary"): ids[12:],
    }
    assert "secret" not in json.dumps(first)

    retrying = True
    attempts.clear()
    payload["jobs"]["vocabulary"] = ids[12:]
    for phrase in payload["phrases"][:12]:
        phrase["words"] = [IDIOM]
    second = []
    run(Request.model_validate(payload), second.append, create, lambda _: None)
    assert attempts == [
        ("en", ids[:12]),
        ("pl", ids[:12]),
        ("vocabulary", ids[12:]),
        ("en", ids[12:]),
        ("pl", ids[12:]),
    ]
    assert len([event for event in second if event["kind"] == "draft"]) == 54
    assert not any(event["kind"] == "issue" for event in second)


def test_provider_quota_diagnostics():
    from workbench.generation import provider_failure

    for quota, value, expected in (
        (
            "GenerateContentInputTokensPerModelPerMinute-FreeTier",
            "16000",
            "tokens_per_minute",
        ),
        ("GenerateRequestsPerMinutePerProjectPerModel", "30", "requests_per_minute"),
        ("GenerateRequestsPerDayPerProjectPerModel", "14400", "daily_quota"),
        ("GenerateRequestsPerDayPerProjectPerModel", "0", "zero_quota"),
        ("UnknownMetric", "1", "rate_limit"),
    ):
        error = RuntimeError()
        error.code = 429
        error.details = {
            "error": {
                "details": [
                    {
                        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                        "violations": [{"quotaId": quota, "quotaValue": value}],
                    }
                ]
            }
        }
        wrapped = GenerationServiceError()
        wrapped.__cause__ = error
        assert provider_failure(wrapped) == expected


def test_workbench_waits_for_provider_capacity(monkeypatch):
    from workbench.transport import GeminiTransport

    transport = GeminiTransport.__new__(GeminiTransport)
    transport.wait_for_recovery = True
    transport.schema = False
    transport.on_event = lambda event: None
    delays = []
    monkeypatch.setattr("workbench.transport.time.sleep", delays.append)
    error = RuntimeError("rate limited")
    error.code = 429
    error.details = {
        "details": [
            {
                "@type": "type.googleapis.com/google.rpc.RetryInfo",
                "retryDelay": "72.5s",
            },
        ]
    }
    outcomes = iter([error] * 4 + ["draft"])

    def generate():
        outcome = next(outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    assert transport._with_retry(generate) == "draft"
    assert delays == [73] * 4


def test_groq_catalog_and_structured_requests(monkeypatch, tmp_path):
    import io

    import pytest
    from workbench import groq_translation as groq
    from workbench.transport import ConfigurationError

    monkeypatch.setattr(config, "ENV_PATHS", ())
    for provider in TRANSLATION_MODELS:
        monkeypatch.delenv(provider.upper() + "_API_KEY", raising=False)
    assert capabilities() == {}
    credentials = tmp_path / "credentials"
    credentials.write_text("GROQ_API_KEY=fixture-key\n")
    monkeypatch.setattr(config, "ENV_PATHS", (credentials,))
    assert list(capabilities()) == ["Groq"]
    monkeypatch.setenv("GEMINI_API_KEY", "fixture-key")
    assert len(capabilities()) == 2
    with pytest.raises(ConfigurationError):
        groq.GroqTransport("unlisted", True, lambda _: None)
    calls = []
    events = []

    def respond(request, timeout):
        assert request.get_header("Authorization") == "Bearer fixture-key"
        calls.append(json.loads(request.data))
        return io.BytesIO(
            json.dumps(
                {
                    "choices": [{"message": {"content": "answer"}}],
                    "usage": {"prompt_tokens_details": {"cached_tokens": 0}},
                }
            ).encode()
        )

    monkeypatch.setattr(groq, "urlopen", respond)
    for model in TRANSLATION_MODELS["Groq"]:
        monkeypatch.delenv("GROQ_API_KEY")
        assert (
            groq.GroqTransport(model, True, events.append, thinking_effort="medium")(
                "prompt", {"type": "object"}
            )
            == "answer"
        )
    assert all(call["reasoning_effort"] == "medium" for call in calls)
    assert calls[0]["reasoning_format"] == "hidden"
    assert [call["response_format"]["type"] for call in calls] == [
        "json_object",
        "json_schema",
        "json_schema",
    ]
    assert events[-1]["cached"] == 0


def test_annotated_sentence_corrected_with_stable_prefix():
    prompts = []

    def create(model, structured, on_event):
        def transport(prompt, schema):
            prompts.append(prompt)
            text = (
                "Be your cat. [zuò nǐ de māo] (zuò: to be; nǐ: you)"
                if len(prompts) == 1
                else "I'll be your cat (meow)."
            )
            return json.dumps({"entries": [{"id": "idiom", "text": text}]})

        return transport

    events = []
    run(request({"en": ["idiom"]}, words=[IDIOM]), events.append, create)
    assert len(prompts) == 2
    assert (
        prompts[0].split("Return only requested IDs.")[0]
        == prompts[1].split("Return only requested IDs.")[0]
    )
    assert [event["value"] for event in events if event["kind"] == "draft"] == [
        "I'll be your cat (meow)."
    ]


def test_contextual_word_alternatives_and_particles():
    words = [
        {"hanzi": "一身", "pinyin": "yīshēn", "translation": {"en": "whole body"}},
        {"hanzi": "的", "pinyin": "de", "translation": {"en": "(particle)"}},
        {"hanzi": "泥泞", "pinyin": "nínìng", "translation": {"en": "mud\nmire"}},
    ]
    req = request({"vocabulary": ["idiom"]})
    req.phrases[0].text = req.timeline[0].lyricKey = "一身的泥泞"

    def create(model, structured, on_event):
        def transport(prompt, schema):
            assert "(particle)" in prompt and "separate lines" in prompt
            return json.dumps({"entries": [{"id": "idiom", "words": words}]})

        return transport

    events = []
    run(req, events.append, create, lambda _: None)
    assert [e["value"] for e in events if e["kind"] == "draft"] == [words]


def test_groq_stream_rate_limit_and_usage(monkeypatch):
    import io
    from urllib.error import HTTPError

    from workbench import groq_translation as groq

    monkeypatch.setattr(config, "ENV_PATHS", ())
    monkeypatch.setenv("GROQ_API_KEY", "mock")
    sleeps = []
    monkeypatch.setattr(groq.time, "sleep", sleeps.append)
    response = io.BytesIO(
        b'data: {"choices":[{"delta":{"content":"{}"},"finish_reason":"stop"}],"usage":{"completion_tokens":1}}\n\ndata: [DONE]\n'
    )
    replies = iter(
        [HTTPError("url", 429, "limited", {"retry-after": "2"}, None), response]
    )

    def respond(*args, **kwargs):
        value = next(replies)
        if isinstance(value, HTTPError):
            raise value
        return value

    monkeypatch.setattr(groq, "urlopen", respond)
    events = []
    assert (
        groq.GroqTransport(TRANSLATION_MODELS["Groq"][0], False, events.append)(
            "json", {}
        )
        == "{}"
    )
    assert sleeps == [2] and events[0]["kind"] == "retry"
    assert events[-1]["cached"] is None and events[-1]["output"] == 1


def test_gemini_reduces_multi_lyric_batch_after_two_token_waits(monkeypatch):
    from workbench.transport import GeminiTransport

    class LimitedTransport(GeminiTransport):
        def __init__(self, model, structured, on_event):
            self.wait_for_recovery = True
            self.schema = structured
            self.on_event = on_event

        def __call__(self, prompt, schema):
            rows = json.loads(prompt.rsplit("\n", 1)[1])["requested"]

            def generate():
                sizes.append(len(rows))
                if len(rows) > 1:
                    error = RuntimeError()
                    error.code = 429
                    error.details = {
                        "details": [
                            {
                                "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                                "violations": [{"quotaId": "InputTokensPerMinute"}],
                            }
                        ]
                    }
                    raise error
                return json.dumps(
                    {"entries": [{"id": rows[0]["id"], "text": "A lyric."}]}
                )

            return self._with_retry(generate)

    sizes, events, waits = [], [], []
    monkeypatch.setattr("workbench.transport.time.sleep", waits.append)
    req = request({"en": ["idiom", "second"]}, words=[IDIOM])
    req.phrases.append(req.phrases[0].model_copy(update={"id": "second"}))
    run(req, events.append, LimitedTransport)
    assert sizes == [2, 2, 1, 1]
    assert waits == [60, 60]
    assert [e["reason"] for e in events if e["kind"] == "retry"] == [
        "tokens_per_minute"
    ] * 2
    assert len([e for e in events if e["kind"] == "draft"]) == 2


def test_groq_access_diagnostics_reach_worker_without_remote_secrets(monkeypatch):
    import io
    from urllib.error import HTTPError

    from workbench import groq_translation as groq

    monkeypatch.setattr(config, "ENV_PATHS", ())
    monkeypatch.setenv("GROQ_API_KEY", "fixture-secret")
    for status, body, expected in [
        (
            401,
            b'{"error":{"code":"invalid_api_key","message":"fixture-secret"}}',
            "invalid_api_key",
        ),
        (403, b"error code: 1010 fixture-secret", "gateway blocked"),
        (403, b"<html>fixture-secret</html>", "non-API"),
    ]:

        def deny(*args, status=status, body=body, **kwargs):
            raise HTTPError("https://example.invalid", status, "", {}, io.BytesIO(body))

        monkeypatch.setattr(groq, "urlopen", deny)
        req = request({"en": ["idiom"]}, words=[IDIOM])
        req.provider, req.model = "Groq", TRANSLATION_MODELS["Groq"][0]
        events = []
        run(req, events.append)
        issues = [event for event in events if event["kind"] == "issue"]
        assert len(issues) == 1
        assert expected in issues[0]["diagnostic"]
        assert f"HTTP {status}" in issues[0]["diagnostic"]
        assert "fixture-secret" not in str(events)


def test_output_truncation_splits_before_resending_full_batch():
    sizes, events = [], []

    class TruncatingTransport:
        def __call__(self, prompt, schema):
            rows = json.loads(prompt.rsplit("\n", 1)[1])["requested"]
            sizes.append(len(rows))
            if len(rows) > 1:
                self.last_response = {"finish_reasons": ["FinishReason.MAX_TOKENS"]}
                return '{"entries": ['
            self.last_response = {"finish_reasons": ["STOP"]}
            return json.dumps({"entries": [{"id": rows[0]["id"], "text": "A lyric."}]})

    req = request({"en": ["idiom", "second"]}, words=[IDIOM])
    req.phrases.append(req.phrases[0].model_copy(update={"id": "second"}))
    run(req, events.append, lambda *args, **kwargs: TruncatingTransport())
    assert sizes == [2, 1, 1]
    assert len([event for event in events if event["kind"] == "draft"]) == 2
    assert any("output limit" in event.get("message", "") for event in events)


def test_groq_workbench_starts_small_and_splits_repeated_token_limits(monkeypatch):
    import io
    from urllib.error import HTTPError

    from workbench import groq_translation as groq

    monkeypatch.setattr(config, "ENV_PATHS", ())
    monkeypatch.setenv("GROQ_API_KEY", "fixture")
    sizes, events, waits = [], [], []

    def respond(http_request, timeout):
        prompt = json.loads(http_request.data)["messages"][0]["content"]
        rows = json.loads(prompt.rsplit("\n", 1)[1])["requested"]
        sizes.append(len(rows))
        if len(sizes) <= 2:
            body = io.BytesIO(
                b'{"error":{"message":"Limit reached for tokens per minute"}}'
            )
            raise HTTPError(
                "https://example.invalid", 429, "", {"retry-after": "2"}, body
            )
        entries = [{"id": row["id"], "text": "A lyric."} for row in rows]
        return io.BytesIO(
            json.dumps(
                {
                    "choices": [
                        {"message": {"content": json.dumps({"entries": entries})}}
                    ]
                }
            ).encode()
        )

    monkeypatch.setattr(groq, "urlopen", respond)
    monkeypatch.setattr(groq.time, "sleep", waits.append)
    ids = ["idiom", "second", "third", "fourth", "fifth"]
    req = request({"en": ids}, words=[IDIOM])
    req.provider, req.model, req.structured = (
        "Groq",
        TRANSLATION_MODELS["Groq"][0],
        True,
    )
    req.phrases.extend(req.phrases[0].model_copy(update={"id": id_}) for id_ in ids[1:])
    run(req, events.append)
    assert sizes == [4, 4, 2, 2, 1]
    assert waits == [2, 2]
    assert [event["reason"] for event in events if event["kind"] == "retry"] == [
        "tokens_per_minute",
        "tokens_per_minute",
    ]
    assert [event["id"] for event in events if event["kind"] == "draft"] == ids
