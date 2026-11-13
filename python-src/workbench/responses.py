"""Decode model output without guessing or changing its content."""
import json
import re
from pydantic import ValidationError


def decode_entries(raw):
    if not isinstance(raw, str): raise ValueError('The API returned no answer text')
    text = raw.lstrip('\ufeff').strip()
    if not text:
        raise ValueError('The API returned no answer text')
    fence = re.fullmatch(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', text, flags=re.I)
    if fence: text = fence.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f'Invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}') from exc
    if not isinstance(data, dict): raise ValueError('Expected a JSON object with an entries array')
    if 'entries' not in data: raise ValueError('Response is missing the entries array')
    if not isinstance(data['entries'], list): raise ValueError('entries must be an array')
    return data['entries']


def validation_reason(error):
    if isinstance(error, ValidationError):
        return '; '.join('.'.join(str(part) for part in item['loc']) + ': ' + item['msg'] for item in error.errors(include_url=False))
    return str(error)
