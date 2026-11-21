# Python workbench backend

Run from the repository root with Python 3.11+ and Node 22.20.0+ (the repository pin is in .n-node-version):

```sh
python3 -m venv --copies python-src/venv
python-src/venv/bin/python -m pip install -r python-src/requirements.txt
npm install
npm run workbench
```

Use an installed Python 3.11+ interpreter for the creation command; replace
`python3` with its absolute path if necessary. On macOS, `/usr/bin/python3` may
invoke Command Line Tools rather than a usable installed interpreter. The
`--copies` option copies the interpreter into the environment instead of symlinking
it. For subsequent Python commands, including one-off scripts, use
`python-src/venv/bin/python`; activation is optional.

The requirements pin Setuptools 84.2.1. Jieba uses its built-in filesystem resource loader with this packaging baseline, avoiding the deprecated `pkg_resources` API. Update existing virtualenvs with the same requirements install command above.

The React editor invokes the Python workers for lyric processing. See the [workbench guide](../web/README.md) for the current workflows.

## Verification

Run the offline Python suite from the repository root.

```sh
python-src/venv/bin/python -m pytest -q
```

Live evaluation is opt-in and sends paid requests:

```sh
python-src/venv/bin/python python-src/evaluate_translation.py lyrics.txt --live --model gemma-4-26b-a4b-it
```

It compares whole-song requests with batches of four (configurable), saving both projects, request/token usage, errors and elapsed time under `workbench-projects/evaluation`. Review both outputs for meaning, literal glosses, dictionary pronunciation, contextual gender and natural English/Polish; record scores and phrase examples in the report. Add `--no-schema` for models without constrained JSON support. Live quality is not inferred from offline tests.

## Formatting

Install `requirements-dev.txt` to get the pinned Ruff formatter. From the repository root, run `npm run format:python` to apply formatting or `npm run format:python:check` to check it. Ruff reads root `ruff.toml`; the original `translate.py` and virtualenv are excluded. Formatting changes are separate from linting and type checking.
