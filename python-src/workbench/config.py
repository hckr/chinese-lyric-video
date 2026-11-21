"""Load local configuration independently of the launch directory."""

import os
from pathlib import Path

from dotenv import load_dotenv

PYTHON_ROOT = Path(__file__).resolve().parents[1]
ENV_PATHS = (PYTHON_ROOT / ".env", PYTHON_ROOT.parent / ".env")


def load_environment():
    # Exported process variables win; Python-specific values precede repo defaults.
    for path in ENV_PATHS:
        load_dotenv(dotenv_path=path, override=False)


def load_api_key(name):
    load_environment()
    return os.getenv(name, "").strip()
