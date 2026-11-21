"""Groq chat completions transport."""

import json
import math
import re
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .config import load_api_key
from .translation_providers import TRANSLATION_MODELS
from .transport import ConfigurationError, ReduceBatch


def access_diagnostic(error):
    """Describe an access rejection without forwarding remote text or headers."""
    body = error.read(65536)
    try:
        parsed = json.loads(body)
        detail = parsed.get("error") if isinstance(parsed, dict) else None
    except (ValueError, UnicodeError):
        detail = None
    code = detail.get("code") if isinstance(detail, dict) else None
    if code == "invalid_api_key":
        explanation = "Groq reported invalid_api_key. Check which GROQ_API_KEY the workbench process loads."
    elif code in ("model_permission_blocked_org", "model_permission_blocked_project"):
        explanation = f"Groq reported {code}. Check the model permissions for the key’s organization and project."
    elif error.code == 401:
        explanation = "Authentication was rejected. Check the active GROQ_API_KEY."
    elif b"error code: 1010" in body.lower() or b"error 1010" in body.lower():
        explanation = "The gateway blocked the client (error 1010). Check the network or proxy used by the worker."
    elif detail is None:
        explanation = "The endpoint returned a non-API access denial. Check the worker’s network or proxy."
    else:
        explanation = "Access was forbidden. Check project and organization permissions for this model."
    trace = error.headers.get("cf-ray", "")
    if re.fullmatch(r"[0-9a-fA-F]{16,32}(?:-[A-Z]{3})?", trace):
        explanation += f" Gateway trace {trace}."
    return f"Groq chat completions · HTTP {error.code}. {explanation}"


class GroqTransport:
    def __init__(self, model, structured, on_event, thinking_effort=None):
        if model not in TRANSLATION_MODELS["Groq"]:
            raise ConfigurationError("Select a supported Groq translation model")
        if thinking_effort == "none" and not model.startswith("qwen/"):
            raise ConfigurationError(
                "This model requires low, medium or high thinking effort"
            )
        self.thinking_effort = thinking_effort
        self.api_key = load_api_key("GROQ_API_KEY")
        if not self.api_key:
            raise ConfigurationError(
                "Set GROQ_API_KEY in python-src/.env or the repository .env."
            )
        self.model = model
        self.structured = structured
        self.on_event = on_event
        self.can_split = False

    def __call__(self, prompt, schema):
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if self.thinking_effort is not None:
            payload["reasoning_effort"] = self.thinking_effort
            if self.model.startswith("qwen/"):
                payload["reasoning_format"] = "hidden"
        streaming = not self.structured
        if streaming:
            payload.update(stream=True, stream_options={"include_usage": True})
        if self.structured and self.model.startswith("openai/gpt-oss"):
            schema = dict(schema, additionalProperties=False)
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "lyric_translation",
                    "strict": True,
                    "schema": schema,
                },
            }
        elif self.structured:
            payload["response_format"] = {"type": "json_object"}
        request = Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=json.dumps(payload).encode(),
            headers={
                "Authorization": "Bearer " + self.api_key,
                "User-Agent": "LyricWorkbench/0.3 (Groq translation)",
                "Content-Type": "application/json",
            },
        )
        backoff = 1
        rate_limits = 0
        while True:
            try:
                with urlopen(request, timeout=120) as response:
                    result = (
                        self.read_stream(response) if streaming else json.load(response)
                    )
                break
            except HTTPError as exc:
                if exc.code in (401, 403):
                    failure = ConfigurationError("Groq access rejected")
                    failure.diagnostic = access_diagnostic(exc)
                    raise failure from exc
                if exc.code == 400:
                    try:
                        error = json.loads(exc.read(65536)).get("error", {})
                    except (ValueError, AttributeError):
                        error = {}
                    if error.get("code") == "json_validate_failed":
                        return ""
                if exc.code == 413:
                    raise
                if exc.code not in (408, 429, 500, 502, 503, 504):
                    raise ConfigurationError("Groq rejected the request") from exc
                if (
                    exc.code == 429
                    and exc.headers.get("x-ratelimit-remaining-requests") == "0"
                ):
                    exc.quota_reason = "daily_quota"
                    raise ConfigurationError("Daily quota exhausted") from exc
                reason = None
                if exc.code == 429:
                    rate_limits += 1
                    try:
                        error_payload = json.loads(exc.read(65536))
                        detail = error_payload.get("error", {})
                        message = str(detail.get("message", "")).lower()
                    except (ValueError, AttributeError):
                        message = ""
                    if (
                        "tokens per minute" in message
                        or exc.headers.get("x-ratelimit-remaining-tokens") == "0"
                    ):
                        reason = "tokens_per_minute"
                    elif "requests per minute" in message:
                        reason = "requests_per_minute"
                else:
                    rate_limits = 0
                hint = exc.headers.get("retry-after", "")
                delay = (
                    math.ceil(float(hint))
                    if hint.replace(".", "", 1).isdigit()
                    else (60 if exc.code == 429 else backoff)
                )
                code = exc.code
            except (TimeoutError, URLError, ConnectionError):
                rate_limits = 0
                delay, code, reason = backoff, None, None
            self.on_event(
                {
                    "kind": "retry",
                    "code": code,
                    "delay": max(1, delay),
                    "reason": reason,
                }
            )
            time.sleep(max(1, delay))
            if rate_limits >= 2 and self.can_split and reason != "requests_per_minute":
                raise ReduceBatch()
            backoff = min(60, 2 * backoff)
        usage = result.get("usage") or {}
        self.on_event(
            {
                "kind": "usage",
                "input": usage.get("prompt_tokens"),
                "output": usage.get("completion_tokens"),
                "cached": (usage.get("prompt_tokens_details") or {}).get(
                    "cached_tokens"
                ),
            }
        )
        choice = result["choices"][0]
        self.last_response = {"finish_reasons": [choice.get("finish_reason")]}
        return choice["message"].get("content") or ""

    def read_stream(self, response):
        chunks = []
        usage = {}
        finish = None
        last_update = 0
        for line in response:
            if not line.startswith(b"data:"):
                continue
            data = line[5:].strip()
            if data == b"[DONE]":
                break
            event = json.loads(data)
            usage = (
                event.get("usage") or (event.get("x_groq") or {}).get("usage") or usage
            )
            for choice in event.get("choices", []):
                finish = choice.get("finish_reason") or finish
                content = choice.get("delta", {}).get("content")
                if content:
                    chunks.append(content)
                if time.monotonic() - last_update >= 1:
                    self.on_event({"kind": "activity"})
                    last_update = time.monotonic()
        if not finish:
            raise ConnectionError("Incomplete Groq stream")
        return {
            "choices": [
                {"finish_reason": finish, "message": {"content": "".join(chunks)}}
            ],
            "usage": usage,
        }
