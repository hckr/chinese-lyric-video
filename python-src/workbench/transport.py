import math
import re
import time
from itertools import count

from httpx2 import TransportError

from .config import load_api_key


class ConfigurationError(RuntimeError):
    pass


class ReduceBatch(Exception):
    """Retry the lyric batch in smaller groups after repeated input-token throttling."""


class GenerationServiceError(RuntimeError):
    pass


def status_code(error):
    value = getattr(error, "code", None) or getattr(error, "status_code", None)
    if value is None:
        value = getattr(getattr(error, "response", None), "status_code", None)
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def error_details(error):
    payload = getattr(error, "details", {})
    body = payload.get("error", payload) if isinstance(payload, dict) else {}
    details = body.get("details") if isinstance(body, dict) else None
    return (
        [detail for detail in details if isinstance(detail, dict)]
        if isinstance(details, list)
        else []
    )


def quota_reason(error):
    reasons = set()
    for detail in error_details(error):
        if detail.get("@type") != "type.googleapis.com/google.rpc.QuotaFailure":
            continue
        violations = detail.get("violations")
        for violation in violations if isinstance(violations, list) else []:
            if not isinstance(violation, dict):
                continue
            quota = str(violation.get("quotaId", "")).lower()
            if str(violation.get("quotaValue")) == "0":
                reasons.add("zero_quota")
            elif "perday" in quota:
                reasons.add("daily_quota")
            elif "perminute" in quota and "token" in quota:
                reasons.add("tokens_per_minute")
            elif "perminute" in quota and "request" in quota:
                reasons.add("requests_per_minute")
    for reason in (
        "zero_quota",
        "daily_quota",
        "tokens_per_minute",
        "requests_per_minute",
    ):
        if reason in reasons:
            return reason
    return "rate_limit"


def retry_delay(error, fallback):
    for detail in error_details(error):
        if detail.get("@type") != "type.googleapis.com/google.rpc.RetryInfo":
            continue
        delay = str(detail.get("retryDelay", ""))
        if re.fullmatch(r"[0-9]{1,12}(\.[0-9]{1,9})?s", delay):
            return max(fallback, math.ceil(float(delay[:-1])))
    return fallback


class GeminiTransport:
    def __init__(
        self,
        model,
        schema=True,
        on_event=lambda event: None,
        timeout_seconds=120,
        wait_for_recovery=False,
    ):
        from google import genai
        from google.genai import types

        key = load_api_key("GEMINI_API_KEY")
        if not key:
            raise ConfigurationError(
                "Set GEMINI_API_KEY in python-src/.env, the repository .env, or the process environment. Import and review do not need credentials."
            )
        self.client = genai.Client(
            api_key=key,
            http_options=types.HttpOptions(
                timeout=int(timeout_seconds * 1000),
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )
        self.model, self.schema = model, schema
        self.on_event = on_event
        self.wait_for_recovery = wait_for_recovery
        try:

            def get_model():
                return self.client.models.get(model=model)

            info = self._with_retry(get_model) if wait_for_recovery else get_model()
            actions = info.supported_actions or []
            if actions and not any("generatecontent" in a.lower() for a in actions):
                raise ConfigurationError("Model does not support generateContent")
        except ConfigurationError:
            raise
        except Exception as exc:
            raise ConfigurationError(f"Model/credential check failed: {exc}") from exc
        self.usage = []
        self.request_count = 0

    def __call__(self, prompt, schema):
        from google.genai import types

        config = types.GenerateContentConfig(temperature=0.1)
        if self.schema:
            config.response_mime_type = "application/json"
            config.response_json_schema = schema

        def generate():
            self.request_count = getattr(self, "request_count", 0) + 1
            response = self.client.models.generate_content(
                model=self.model, contents=prompt, config=config
            )
            self.last_response = {
                "finish_reasons": [
                    str(getattr(candidate, "finish_reason", "unknown"))
                    for candidate in (getattr(response, "candidates", None) or [])
                ],
                "block_reason": str(
                    getattr(
                        getattr(response, "prompt_feedback", None), "block_reason", None
                    )
                    or ""
                ),
                "usage": response.usage_metadata.model_dump(mode="json")
                if response.usage_metadata
                else {},
            }
            self.usage.append(self.last_response["usage"])
            if getattr(self, "wait_for_recovery", False):
                usage = self.last_response["usage"]
                self.on_event(
                    {
                        "kind": "usage",
                        "input": usage.get("prompt_token_count"),
                        "output": usage.get("candidates_token_count"),
                        "cached": usage.get("cached_content_token_count"),
                    }
                )
            return response.text or ""

        return self._with_retry(generate)

    def _with_retry(self, operation):
        wait_for_recovery = getattr(self, "wait_for_recovery", False)
        maximum = None if wait_for_recovery else 3
        for attempt in count():
            try:
                getattr(self, "on_event", lambda event: None)(
                    {
                        "kind": "attempt",
                        "attempt": attempt + 1,
                        "maximum": maximum,
                        "structured": self.schema,
                    }
                )
                return operation()
            except Exception as exc:
                code = status_code(exc)
                if code in (400, 401, 403, 404):
                    raise ConfigurationError(
                        f"Generation configuration failed: {exc}"
                    ) from exc
                transient = code in (408, 429, 500, 502, 503, 504) or isinstance(
                    exc, (TimeoutError, ConnectionError, TransportError)
                )
                if not transient:
                    raise
                quota = quota_reason(exc) if code == 429 else None
                if wait_for_recovery and quota in ("zero_quota", "daily_quota"):
                    raise ConfigurationError(
                        "Gemini quota unavailable for this run"
                    ) from exc
                if maximum is not None and attempt + 1 >= maximum:
                    reason = (
                        f"HTTP {code}"
                        if code is not None
                        else "a network timeout or connection error"
                    )
                    hint = (
                        " If this repeats, try disabling structured JSON output in Model settings."
                        if self.schema
                        else ""
                    )
                    raise GenerationServiceError(
                        f"Google generation failed with {reason} after 3 attempts. No translation response was received. Retry the pending work later."
                        + hint
                    ) from exc
                delay = 2 ** min(attempt, 6)
                if wait_for_recovery:
                    delay = retry_delay(exc, max(60, delay) if code == 429 else delay)
                getattr(self, "on_event", lambda event: None)(
                    {
                        "kind": "retry",
                        "attempt": attempt + 1,
                        "maximum": maximum,
                        "code": code,
                        "delay": delay,
                        "reason": quota,
                    }
                )
                time.sleep(delay)
                if (
                    wait_for_recovery
                    and attempt >= 1
                    and quota == "tokens_per_minute"
                    and getattr(self, "can_split", False)
                ):
                    raise ReduceBatch() from exc
