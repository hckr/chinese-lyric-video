"""Model catalog for translation provider discovery and validation."""

from .config import load_api_key

# Groq models are allowlisted against console.groq.com/docs/rate-limits.
TRANSLATION_MODELS = {
    "Groq": ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    "Gemini": ["gemma-4-31b-it", "gemma-4-26b-a4b-it"],
}


def capabilities():
    return {
        name: models
        for name, models in TRANSLATION_MODELS.items()
        if load_api_key(name.upper() + "_API_KEY")
    }
