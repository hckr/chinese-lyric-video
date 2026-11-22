import pytest
from workbench.automatic_timing import run


def test_transcript_alignment_keeps_unresolved_and_reports_progress(capsys):
    project = {
        "phrases": [{"id": "p", "lyricKey": "你好"}],
        "occurrences": [{"id": "a", "phraseId": "p"}],
    }
    run(
        {
            "project": project,
            "durationMs": 5000,
            "transcript": {
                "segments": [{"words": [{"word": "你好", "start": 1, "end": 2}]}]
            },
        }
    )
    import json

    messages = [json.loads(s) for s in capsys.readouterr().out.splitlines()]
    line = messages[-1]["result"]["lines"][0]
    assert line["id"] == "a"
    assert line["observedStartMs"] == 1000
    assert line["observedEndMs"] == 2000


def test_invalid_duration_rejected():
    with pytest.raises(ValueError, match="eight minutes"):
        run({"project": {}, "durationMs": 900000})


def test_unassigned_intro_is_an_optional_flagged_addition(capsys):
    project = {
        "phrases": [{"id": "p", "lyricKey": "你好"}],
        "occurrences": [{"id": "a", "phraseId": "p"}],
    }
    run(
        {
            "project": project,
            "durationMs": 5000,
            "transcript": {
                "segments": [
                    {
                        "words": [
                            {"word": "小哥哥小哥哥", "start": 0.1, "end": 0.3},
                            {"word": "小哥哥小哥哥", "start": 0.55, "end": 0.8},
                        ]
                    },
                    {"words": [{"word": "你好", "start": 1, "end": 2}]},
                ]
            },
        }
    )
    import json

    result = json.loads(capsys.readouterr().out.splitlines()[-1])["result"]
    assert result["additions"][0]["occurrence"]["detectedFromAudio"] is True
    assert result["additions"][0]["phrase"]["review"] == "pending"
    assert result["additions"][0]["phrase"]["lyricKey"] == "小哥哥" * 4
    assert result["additions"][0]["timedWords"] == [
        {"text": "小哥哥小哥哥", "startMs": 100, "endMs": 300},
        {"text": "小哥哥小哥哥", "startMs": 550, "endMs": 800},
    ]
    assert project["occurrences"] == [{"id": "a", "phraseId": "p"}]


def test_range_limits_observations_and_preserves_order(capsys):
    import json

    project = {
        "phrases": [{"id": "p", "lyricKey": "你好"}],
        "occurrences": [
            {"id": "first", "phraseId": "p"},
            {"id": "second", "phraseId": "p"},
        ],
    }
    run(
        {
            "project": project,
            "durationMs": 5000,
            "ids": ["second"],
            "startMs": 2000,
            "endMs": 4000,
            "transcript": {
                "segments": [
                    {
                        "words": [
                            {"word": "你好", "start": 0.5, "end": 1},
                            {"word": "你好", "start": 2.5, "end": 3},
                        ]
                    }
                ]
            },
        }
    )
    result = json.loads(capsys.readouterr().out.splitlines()[-1])["result"]
    assert [l["id"] for l in result["lines"]] == ["second"]
    assert result["lines"][0]["observedStartMs"] == 2500


@pytest.mark.parametrize(
    "transcript",
    [
        {"segments": [{"text": "你好"}]},
        {"segments": [{"words": [{"word": "你好", "start": 2, "end": 1}]}]},
    ],
)
def test_bad_transcript_preserves_project(transcript):
    project = {
        "phrases": [{"id": "p", "lyricKey": "你好"}],
        "occurrences": [{"id": "first", "phraseId": "p"}],
    }
    with pytest.raises(ValueError):
        run({"project": project, "durationMs": 5000, "transcript": transcript})
    assert project["occurrences"] == [{"id": "first", "phraseId": "p"}]


def test_cached_model_path_uses_pcm_loader_without_downloading(
    tmp_path, monkeypatch, capsys
):
    import sys
    import wave
    from pathlib import Path
    from types import SimpleNamespace

    import numpy as np

    cache = tmp_path / ".cache" / "whisper"
    cache.mkdir(parents=True)
    (cache / "medium.pt").write_bytes(b"test")
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    audio = tmp_path / "audio.media"
    with wave.open(str(audio), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\x00\x00" * 16000)

    def transcribe(samples, **kwargs):
        assert isinstance(samples, np.ndarray)
        assert kwargs["word_timestamps"] is True
        return {"segments": [{"words": [{"word": "你好", "start": 0.1, "end": 0.8}]}]}

    def load_model(path, device):
        assert path == str(cache / "medium.pt") and device == "cpu"
        return SimpleNamespace(transcribe=transcribe)

    monkeypatch.setitem(sys.modules, "whisper", SimpleNamespace(load_model=load_model))
    monkeypatch.setitem(
        sys.modules, "torch", SimpleNamespace(set_num_threads=lambda _: None)
    )
    run(
        {
            "project": {
                "phrases": [{"id": "p", "lyricKey": "你好"}],
                "occurrences": [{"id": "o", "phraseId": "p"}],
            },
            "durationMs": 1000,
            "audioPath": str(audio),
        }
    )
    assert '"observedStartMs": 100' in capsys.readouterr().out


def test_normalized_identity_matches_renamed_pcm_and_keeps_external_provenance_unverified(
    tmp_path, capsys
):
    import json
    import wave
    from shutil import copyfile

    audio = tmp_path / "original.wav"
    with wave.open(str(audio), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\x01\x00" * 16000)
    renamed = tmp_path / "renamed.media"
    copyfile(audio, renamed)
    request = {
        "project": {"phrases": [], "occurrences": []},
        "ids": [],
        "durationMs": 1000,
        "identityOnly": True,
    }
    # Identity checks do not require lyrics, transcript, or a cached model.
    from workbench.automatic_timing import normalized_audio

    run({**request, "audioPath": str(audio)})
    response = json.loads(capsys.readouterr().out)
    first, identity = normalized_audio(str(audio))
    assert response["audioIdentity"] == identity
    second, renamed_identity = normalized_audio(str(renamed))
    assert identity == renamed_identity
    assert identity["encoding"] == "mono-f32le-16000"
    assert len(identity["sha256"]) == 64
    assert (first == second).all()
    # Same normalized samples in another valid WAV container have the same hash.
    with wave.open(str(renamed), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\x02\x00" * 16000)
    assert normalized_audio(str(renamed))[1] != identity


@pytest.mark.parametrize("model", ["whisper-large-v3-turbo", "whisper-large-v3"])
def test_groq_transcription_alignment(model, monkeypatch, capsys, tmp_path):
    import json

    import numpy as np
    from workbench import automatic_timing, config
    from workbench import groq_whisper as groq

    audio = np.zeros(32000, dtype=np.float32)
    monkeypatch.setattr(automatic_timing, "normalized_audio", lambda _: (audio, {}))
    credentials = tmp_path / "credentials"
    credentials.write_text("GROQ_API_KEY=mock\n")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setattr(config, "ENV_PATHS", (credentials,))
    calls = []

    def post(url, **kwargs):
        calls.append(kwargs)
        assert kwargs["headers"]["Authorization"] == "Bearer mock"
        assert kwargs["data"]["model"] == model
        assert kwargs["files"]["file"][1][:4] == b"RIFF"
        assert kwargs["data"]["timestamp_granularities[]"] == ["segment", "word"]
        if len(calls) == 1:
            return groq.httpx2.Response(429, headers={"retry-after": "2"})
        return groq.httpx2.Response(
            200,
            json={
                "segments": [{"start": 0, "end": 2}],
                "words": [{"word": "你好", "start": 0.5, "end": 1.5}],
            },
        )

    waits = []
    monkeypatch.setattr(groq.httpx2, "post", post)
    monkeypatch.setattr(groq.time, "sleep", waits.append)
    run(
        {
            "project": {
                "phrases": [{"id": "p", "lyricKey": "你好"}],
                "occurrences": [{"id": "a", "phraseId": "p"}],
            },
            "audioPath": "mock",
            "durationMs": 2000,
            "provider": "groq",
            "model": model,
        }
    )
    assert waits == [2]
    line = json.loads(capsys.readouterr().out.splitlines()[-1])["result"]["lines"][0]
    assert (line["observedStartMs"], line["observedEndMs"]) == (500, 1500)


def test_groq_timing_errors(monkeypatch):
    import numpy as np
    from workbench import config
    from workbench import groq_whisper as groq

    audio = np.zeros(16)
    monkeypatch.setattr(config, "ENV_PATHS", ())
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    with pytest.raises(ValueError, match="GROQ_API_KEY"):
        groq.transcribe(audio, groq.MODELS[0], lambda _: None)
    monkeypatch.setenv("GROQ_API_KEY", "mock")
    for response, message in [
        (groq.httpx2.Response(403), "denied"),
        (groq.httpx2.Response(200, json={"segments": []}), "no word timestamps"),
    ]:
        monkeypatch.setattr(
            groq.httpx2, "post", lambda *args, response=response, **kwargs: response
        )
        with pytest.raises(ValueError, match=message):
            groq.transcribe(audio, groq.MODELS[0], lambda _: None)
