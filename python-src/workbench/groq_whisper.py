"""Transcribe normalized Timing audio with Groq's word timestamps."""

import io
import math
import time
import wave

import httpx2
import numpy as np

from .config import load_api_key

MODELS = ("whisper-large-v3-turbo", "whisper-large-v3")


def transcribe(audio, model, emit, language="zh"):
    if model not in MODELS:
        raise ValueError("Unsupported Groq Whisper model")
    key = load_api_key("GROQ_API_KEY")
    if not key:
        raise ValueError("Configure GROQ_API_KEY or select local Whisper")
    # Timing's eight-minute maximum fits in one 15.4 MB mono PCM WAV.
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setparams((1, 2, 16000, 0, "NONE", ""))
        wav.writeframes(np.clip(audio * 32768, -32768, 32767).astype("<i2").tobytes())
    delay = 2
    while True:
        emit({"progress": f"Transcribing with Groq · {model}"})
        try:
            response = httpx2.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": "Bearer " + key},
                data={
                    "model": model,
                    **({"language": language} if language else {}),
                    "response_format": "verbose_json",
                    "timestamp_granularities[]": ["segment", "word"],
                },
                files={"file": ("audio.wav", buffer.getvalue(), "audio/wav")},
                timeout=120,
            )
        except httpx2.TransportError:
            response = None
        if response is not None and response.is_success:
            break
        status = response.status_code if response is not None else None
        if (
            status == 429
            and response.headers.get("x-ratelimit-remaining-requests") == "0"
        ):
            raise ValueError(
                "Groq daily request allowance exhausted. Select local Whisper or retry after reset."
            )
        if status in (401, 403):
            raise ValueError(
                "Groq denied access. Check GROQ_API_KEY and model permissions."
            )
        if status not in (None, 408, 429, 500, 502, 503, 504):
            raise ValueError(f"Groq rejected transcription (HTTP {status}).")
        retry = response.headers.get("retry-after", "") if response is not None else ""
        wait = (
            max(1, int(retry))
            if retry.isdigit()
            else max(delay, 60 if status == 429 else 1)
        )
        emit({"progress": f"Groq transcription paused · retrying in {wait}s"})
        time.sleep(wait)
        delay = min(delay * 2, 60)
    data = response.json()
    segments = data.get("segments", [])
    words = data.get("words")
    duration = len(audio) / 16000
    if not isinstance(words, list) or not words:
        raise ValueError(
            "Groq returned no word timestamps. Try the other Whisper model or local transcription."
        )
    valid_words = []

    for word in words:
        a, b = word.get("start"), word.get("end")
        if (
            isinstance(a, (int, float))
            and isinstance(b, (int, float))
            and math.isfinite(a)
            and math.isfinite(b)
            and 0 <= a <= b <= duration
        ):
            valid_words.append(word)

    discarded = len(words) - len(valid_words)
    if discarded:
        emit(
            {"progress": f"Groq returned {discarded} invalid word timestamps; skipped."}
        )

    if not valid_words:
        raise ValueError("Groq returned no valid word timestamps.")

    grouped = [dict(segment, words=[]) for segment in segments] or [{"words": []}]
    index = 0
    for word in valid_words:
        midpoint = (word["start"] + word["end"]) / 2
        while index + 1 < len(grouped) and midpoint >= grouped[index + 1]["start"]:
            index += 1
        grouped[index]["words"].append(word)
    return {"segments": grouped}
