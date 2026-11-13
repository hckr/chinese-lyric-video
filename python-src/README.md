# Chinese lyric workbench

Run from the repository root with Python 3.11+ and Node 18.18+ (Node 22 recommended for repository lint):

```sh
python3 -m venv python-src/venv
python-src/venv/bin/pip install -r python-src/requirements.txt
npm install
python-src/venv/bin/streamlit run python-src/app.py
```

The app starts without opening a browser window. Open the local URL printed in the terminal when you want to use it. This is configured in `python-src/.streamlit/config.toml` and works whether you launch from the repository root or `python-src`. Watchdog is included in the requirements for efficient file watching and reloads when code changes. Restart an already running Streamlit process after installing it.

The existing `python-src/translate.py` remains a separate proof of concept. No renderer files are changed.

All Python code lives in `python-src`: `app.py` is the Streamlit entry point, `workbench/` contains the backend modules, `tests/` contains offline tests, and `evaluate_translation.py` is the opt-in live evaluation. The Node parser remains in `scripts/import-song.cjs`. The `pytest.ini` at the repository root configures the Python import path.

Dependencies are pinned to the current direct releases checked on 2026-11-12, including Streamlit 1.67.0 and Google Gen AI 3.2.0. Install updates with:

```sh
python-src/venv/bin/python -m pip install --upgrade -r python-src/requirements.txt
```

You can also launch from `python-src` with `venv/bin/streamlit run app.py`. Repository song and dictionary paths resolve relative to the code, independent of the working directory. Local project paths resolve relative to your current working directory.

## Import and review without credentials

Choose **Import Macchiato**. A Node helper uses the installed TypeScript compiler API to read literal metadata, timeline and dictionary entries. It does not execute the module. Unsupported data expressions, spreads and calls fail with a clear error. The `lines` getter is ignored and reconstructed on export. This importer targets the repository song format, not arbitrary TypeScript programs.

Imported phrases start unverified; their generation provenance is unknown. Translations, word order, lyric keys, line IDs, repetitions and timestamps are preserved. **Populate dictionary review reference** separately loads the local `public/cedict_1_0_ts_utf-8_mdbg.txt` file. These references do not claim to have been used for the imported translations. The dictionary file is optional for offline import and review.

Import opens **All lyrics**, showing the complete song in timeline order, including repetitions, Chinese, Pinyin, English, Polish and review status. Select a row to open **Review phrase**, or switch to that view and use its phrase selector. Repeated lines share one phrase, so editing it updates every occurrence. Switch back to **All lyrics** to read the whole song.

In **Review phrase**, edit English and Polish, and edit vocabulary or grammar rows in the table. Add/delete rows using the table controls and change Order numbers to reorder them. Empty Hanzi/Pinyin fields allow grammar insertions or non-Chinese words. Pinyin is normalized on commit; numbered forms, `u:`, `v`, diacritics and neutral tone 0/5 are supported. Pronunciation is never inferred again from Hanzi. Vocabulary changes mark both sentences as needing review without replacing them. Mark the phrase reviewed when satisfied. Generated vocabulary must cover every Chinese character in source order, use Chinese-only Hanzi fields, include nonempty glosses, and provide plausible Pinyin syllables with matching counts (including erhua). Placeholder pronunciations and phrase-level label rows are rejected before replacement. These checks validate structure, not the correctness of every reading or gloss, so review is still needed. Invalid older projects remain openable for repair; invalid vocabulary cannot be used for sentence generation or TypeScript export.

Click **Commit phrase edits before navigating**. Committed edits survive Streamlit reruns and navigation within the session. Save to a local path for durability across restarts, or download JSON. Reopen a saved path or upload and load JSON to continue; malformed or incompatible projects are rejected. Saves validate the project and atomically replace the previous file. Uncommitted form values are not saved.

## New songs

Paste raw lyrics, with manual newlines for desired splits. Ingestion converts Traditional to Simplified, strips standalone bracketed section labels and common section names, splits punctuation/newlines, and deduplicates phrases while retaining repetitions in the timeline. Long phrases produce midpoint split suggestions; choose musically appropriate boundaries yourself before ingestion. New timeline entries have zero placeholders, requiring manual timing after export. Import and raw ingestion replace the current in-memory project, so save edits first.

## Generation and recovery

Set `GEMINI_API_KEY` in `python-src/.env`, the repository-root `.env`, or your process environment. The workbench and live evaluator load these files automatically before generation, regardless of the launch directory. Exported process variables take precedence, followed by `python-src/.env`, then the root `.env`. Restart Streamlit after changing previously loaded values. Credentials are used only for generation. Choose a model and optional song-level translation notes. Gemma is configurable; available model metadata and `generateContent` support are checked. Schema support is not universally advertised by the API: use the schema checkbox to select constrained JSON generation, and disable it for models that reject that configuration. Configuration/credential failures stop immediately rather than silently falling back. The SDK interface follows the [Google Gen AI SDK documentation](https://googleapis.github.io/python-genai/).

The default model is `gemma-4-26b-a4b-it`; it remains editable in Model settings. Default generation makes three whole-song calls: vocabulary/Pinyin, English, then Polish directly from Chinese. Each request includes full song order and requests entries by unique phrase ID. Sentence calls use validated vocabulary; vocabulary calls automatically load dictionary references when the local CEDICT file is available, and include word-boundary hints from Jieba. These new injections are recorded in generation provenance; they do not retroactively change the unknown provenance of imported translations. Selected Keep Walking examples provide editorial guidance, never Macchiato. Neutral/general statements must not gain gendered participants; first-person narration remains personal. Notes, model, prompt version and exact injected context are recorded per successful component.

Use **Translate lyrics** from either workspace view. Choose **Whole song** or **Current phrase** (available in the phrase editor), then choose the action and content types. **Fill missing content** preserves existing imported translations and committed edits, and resumes pending work. If everything already exists, the app explains that nothing needs generation and disables the button; it does not contact the API. To get fresh model translations for an imported song, choose **Replace selected content**. The preview states how many phrases will change, and the button explicitly says Replace. Vocabulary-only replacements flag existing sentences for review without replacing them.

During generation, the app shows the current content type and completed updates. Afterwards, a persistent **Last generation result** reports the number of updates, generation requests, errors and save location. Updated content is immediately visible in the editor and full-song table. The result stays visible across navigation until dismissed or another project is loaded. **Model responses and validation details** retains response text, finish reasons, token usage and exact rejection reasons; download these with **Download generation diagnostics** if a response is invalid. Markdown-fenced JSON is accepted, but field validation remains strict. Corrective requests receive the specific errors rather than a generic retry instruction. Diagnostics contain model output and project labels, so review the file before sharing it. Failed saves are reported separately from successful in-memory updates.

Valid entries checkpoint immediately to the local project path. Invalid/missing entries receive one corrective request; persistent groups split until individual failures are reported. Transient requests retry up to three attempts with bounded backoff and a configurable timeout per attempt (120 seconds by default; change it in Model settings). Live progress and the result’s Request attempts section show each attempt and retry delay; the request count includes transient retries. If Google still returns 500/504 after all attempts, the app reports that no response was received and leaves unsuccessful work pending. Such a provider error does not establish that structured output is unsupported. Reopen the checkpoint and run pending generation to recover after interruption; completed components are skipped. Persistent single failures remain pending. Dictionary loading and generation are separate actions.

## Export

**Download TypeScript** creates a standalone song module matching the existing renderer shape. Drafts with incomplete/unverified content show a warning but remain exportable. Invalid model values block export. Export preserves imported timing and does not overwrite source songs. Review the download, place it under `src/` yourself, set timing for new songs, and register compositions manually as needed. No timing editor or automatic registration is included.

## Verification

```sh
python-src/venv/bin/python -m pytest -q
npm run lint
# Optional development type checker
python-src/venv/bin/pip install -r python-src/requirements-dev.txt
python-src/venv/bin/ty check --extra-search-path python-src python-src/app.py python-src/workbench python-src/evaluate_translation.py
```

Offline tests cover Simplified conversion, parsing/deduplication, Pinyin normalization and rejection, versioned validation, atomic save/reopen, per-entry retries and batch splitting, independent language recovery, credential failures, transient retries, AppTest import/edit/navigation/save/reopen, and Macchiato export fidelity including TypeScript compilation.

Live evaluation is opt-in and sends paid requests:

```sh
python-src/venv/bin/python python-src/evaluate_translation.py lyrics.txt --live --model gemma-4-26b-a4b-it
```

It compares whole-song requests with batches of four (configurable), saving both projects, request/token usage, errors and elapsed time under `workbench-projects/evaluation`. Review both outputs for meaning, literal glosses, dictionary pronunciation, contextual gender and natural English/Polish; record scores and phrase examples in the report. Add `--no-schema` for models without constrained JSON support. Live quality is not inferred from offline tests.
