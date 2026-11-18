"""Local timing worker. Emits newline-delimited progress/results, never downloads models."""

import json
import sys
from pathlib import Path
from .timing_evaluation import evaluate


def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)


def normalized_audio(audio_path):
    import hashlib
    import wave
    import numpy as np

    audio = audio_path
    try:
        with wave.open(audio) as wav:
            if (
                wav.getframerate() == 16000
                and wav.getnchannels() == 1
                and wav.getsampwidth() == 2
            ):
                audio = (
                    np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2").astype(
                        np.float32
                    )
                    / 32768
                )
    except (wave.Error, EOFError):
        pass
    if isinstance(audio, str):
        import os
        import platform
        import shutil
        import subprocess

        decoder = shutil.which("ffmpeg")
        env = os.environ.copy()
        if decoder is None:
            # Reuse the already installed Remotion decoder; never install software.
            system = {"Darwin": "darwin", "Linux": "linux", "Windows": "win32"}.get(
                platform.system()
            )
            arch = {
                "x86_64": "x64",
                "AMD64": "x64",
                "arm64": "arm64",
                "aarch64": "arm64",
            }.get(platform.machine())
            packages = (
                Path(__file__).resolve().parents[2] / "node_modules" / "@remotion"
            )
            if system and arch:
                for folder in sorted(packages.glob(f"compositor-{system}-{arch}*")):
                    candidate = folder / (
                        "ffmpeg.exe" if system == "win32" else "ffmpeg"
                    )
                    if candidate.is_file():
                        decoder = str(candidate)
                        key = (
                            "DYLD_LIBRARY_PATH"
                            if system == "darwin"
                            else "LD_LIBRARY_PATH"
                        )
                        env[key] = str(folder) + (
                            os.pathsep + env[key] if env.get(key) else ""
                        )
                        break
        if decoder is None:
            raise ValueError(
                "No installed FFmpeg decoder is available. Use a mono 16kHz PCM WAV file or install FFmpeg manually."
            )
        try:
            decoded = subprocess.run(
                [
                    decoder,
                    "-nostdin",
                    "-threads",
                    "1",
                    "-i",
                    audio,
                    "-t",
                    "481",
                    "-f",
                    "s16le",
                    "-ac",
                    "1",
                    "-acodec",
                    "pcm_s16le",
                    "-ar",
                    "16000",
                    "-",
                ],
                capture_output=True,
                env=env,
                check=True,
            )
        except (OSError, subprocess.CalledProcessError) as error:
            raise ValueError(
                "The installed FFmpeg decoder could not decode this recording. Use a mono 16kHz PCM WAV file, or repair your local FFmpeg installation."
            ) from error
        audio = np.frombuffer(decoded.stdout, dtype="<i2").astype(np.float32) / 32768
    if len(audio) > 480 * 16000:
        raise ValueError("Timing supports audio up to eight minutes")
    identity = {
        "sha256": hashlib.sha256(np.asarray(audio, dtype="<f4").tobytes()).hexdigest(),
        "encoding": "mono-f32le-16000",
    }
    return audio, identity


def run(request):
    project = request["project"]
    duration = request["durationMs"]
    if not isinstance(duration, int) or not 0 < duration <= 480000:
        raise ValueError("Timing supports audio up to eight minutes")
    if request.get("identityOnly"):
        _, identity = normalized_audio(request["audioPath"])
        emit({"audioIdentity": identity})
        return
    all_ids = [o["id"] for o in project["occurrences"]]
    ids = request.get("ids", all_ids)
    if not ids or len(ids) != len(set(ids)) or any(id_ not in all_ids for id_ in ids):
        raise ValueError("Choose a valid lyric range")
    positions = [all_ids.index(id_) for id_ in ids]
    if positions != list(range(positions[0], positions[-1] + 1)):
        raise ValueError("Choose consecutive lyrics in project order")
    start = request.get("startMs", 0)
    end = request.get("endMs", duration)
    if not 0 <= start < end <= duration:
        raise ValueError("Invalid alignment range")
    transcript = request.get("transcript")
    identity = None
    if request.get("audioPath"):
        audio, identity = normalized_audio(request["audioPath"])
    if transcript is None:
        import whisper
        import torch

        torch.set_num_threads(4)
        model_name = request.get("model", "medium")
        if model_name not in {"base", "small", "medium", "large-v3-turbo"}:
            raise ValueError("Unsupported model")
        model_path = Path.home() / ".cache" / "whisper" / (model_name + ".pt")
        if not model_path.is_file():
            raise ValueError(
                "Model is not cached. Install its weights manually before running timing."
            )
        emit({"progress": "Loading cached model"})
        model = whisper.load_model(str(model_path), device="cpu")
        emit({"progress": "Transcribing audio; this can take several minutes"})
        transcript = model.transcribe(
            audio,
            language="zh",
            word_timestamps=True,
            fp16=False,
            verbose=False,
        )
    emit({"progress": "Aligning supplied lyrics"})
    if not isinstance(transcript, dict) or not isinstance(
        transcript.get("segments"), list
    ):
        raise ValueError("Expected a Whisper JSON with segments and word timestamps")
    segments = []
    for segment in transcript["segments"]:
        words = segment.get("words")
        if not isinstance(words, list):
            raise ValueError("Transcript requires word timestamps")
        kept = []
        for word in words:
            a, b = word["start"], word["end"]
            if (
                not isinstance(a, (int, float))
                or not isinstance(b, (int, float))
                or not 0 <= a <= b <= duration / 1000 + 1
            ):
                raise ValueError("Invalid transcript word timestamp")
            if a * 1000 >= start and b * 1000 <= end:
                kept.append(word)
        if kept:
            segments.append(dict(segment, words=kept))
    transcript = dict(transcript, segments=segments)
    phrases = {p["id"]: p for p in project["phrases"]}
    song = {
        "TIMELINE": [
            dict(
                o, lyricKey=phrases[o["phraseId"]]["lyricKey"], startMs=None, endMs=None
            )
            for o in project["occurrences"]
            if o["id"] in ids
        ]
    }
    if (
        sum(len(c["lyricKey"]) for c in song["TIMELINE"]) > 5000
        or sum(len(w["word"]) for s in segments for w in s["words"]) > 7000
    ):
        raise ValueError("Alignment input is too large; select a smaller range")
    result = evaluate(song, transcript, request["durationMs"])
    lines = result["modes"]["assigned_toneless"]["lines"]
    owned = {(a["startMs"], a["endMs"]) for line in lines for a in line["assignment"]}
    additions = []
    from .react_ingest import draft_project
    from uuid import uuid4

    for segment in segments:
        words = segment["words"]
        # Offer only wholly unassigned passages outside supplied lyric spans.
        if any(
            (round(w["start"] * 1000), round(w["end"] * 1000)) in owned for w in words
        ):
            continue
        text = "".join(w["word"] for w in words).strip()
        a, b = round(words[0]["start"] * 1000), round(words[-1]["end"] * 1000)
        if (
            not text
            or b <= a
            or any(
                a < line.get("observedEndMs", -1)
                and b > line.get("observedStartMs", duration)
                for line in lines
            )
        ):
            continue
        draft = draft_project(text)
        for phrase in draft["phrases"]:
            phrase["id"] = "audio-phrase-" + uuid4().hex
            for word in phrase["words"]:
                word["id"] = "audio-word-" + uuid4().hex
            additions.append(
                {
                    "phrase": phrase,
                    "occurrence": {
                        "id": "audio-" + uuid4().hex,
                        "phraseId": phrase["id"],
                        "startMs": a,
                        "endMs": b,
                        "detectedFromAudio": True,
                    },
                }
            )
    emit(
        {"result": {"lines": lines, "additions": additions}, "audioIdentity": identity}
    )


if __name__ == "__main__":
    try:
        run(json.loads(sys.stdin.read()))
    except Exception as error:
        emit({"error": str(error)})
        sys.exit(1)
