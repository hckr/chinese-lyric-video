import os
import time
from httpx2 import TransportError
from .config import load_environment

class ConfigurationError(RuntimeError): pass

class GenerationServiceError(RuntimeError): pass


def status_code(error):
    value = getattr(error, 'code', None) or getattr(error, 'status_code', None)
    if value is None: value = getattr(getattr(error, 'response', None), 'status_code', None)
    if value is None: return None
    try: return int(value)
    except (TypeError, ValueError): return None


class GeminiTransport:
    def __init__(self, model, schema=True, on_event=lambda event: None, timeout_seconds=120):
        from google import genai
        from google.genai import types
        load_environment()
        key = os.getenv('GEMINI_API_KEY')
        if not key: raise ConfigurationError('Set GEMINI_API_KEY in python-src/.env, the repository .env, or the process environment. Import and review do not need credentials.')
        self.client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=int(timeout_seconds * 1000), retry_options=types.HttpRetryOptions(attempts=1)))
        self.model, self.schema = model, schema
        self.on_event = on_event
        try:
            info = self.client.models.get(model=model)
            actions = info.supported_actions or []
            if actions and not any('generatecontent' in a.lower() for a in actions): raise ConfigurationError('Model does not support generateContent')
        except ConfigurationError: raise
        except Exception as exc: raise ConfigurationError(f'Model/credential check failed: {exc}') from exc
        self.usage = []
        self.request_count = 0

    def __call__(self, prompt, schema):
        from google.genai import types
        config = types.GenerateContentConfig(temperature=0.1)
        if self.schema:
            config.response_mime_type = 'application/json'
            config.response_json_schema = schema
        for attempt in range(3):
            try:
                self.request_count = getattr(self, 'request_count', 0) + 1
                getattr(self, 'on_event', lambda event: None)({'kind': 'attempt', 'attempt': attempt+1, 'maximum': 3, 'structured': self.schema})
                response = self.client.models.generate_content(model=self.model, contents=prompt, config=config)
                self.last_response = {
                    'finish_reasons': [str(getattr(candidate, 'finish_reason', 'unknown')) for candidate in (getattr(response, 'candidates', None) or [])],
                    'block_reason': str(getattr(getattr(response, 'prompt_feedback', None), 'block_reason', None) or ''),
                    'usage': response.usage_metadata.model_dump(mode='json') if response.usage_metadata else {},
                }
                self.usage.append(self.last_response['usage'])
                return response.text or ''
            except Exception as exc:
                code = status_code(exc)
                if code in (400, 401, 403, 404): raise ConfigurationError(f'Generation configuration failed: {exc}') from exc
                transient = code in (408, 429, 500, 502, 503, 504) or isinstance(exc, (TimeoutError, ConnectionError, TransportError))
                if not transient: raise
                if attempt == 2:
                    reason = f'HTTP {code}' if code is not None else 'a network timeout or connection error'
                    hint = ' If this repeats, try disabling structured JSON output in Model settings.' if self.schema else ''
                    raise GenerationServiceError(f'Google generation failed with {reason} after 3 attempts. No translation response was received. Retry the pending work later.' + hint) from exc
                delay = 2 ** attempt
                getattr(self, 'on_event', lambda event: None)({'kind': 'retry', 'attempt': attempt+1, 'maximum': 3, 'code': code, 'delay': delay})
                time.sleep(delay)
