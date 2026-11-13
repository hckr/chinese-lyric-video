# React Lyric Workbench — checkpoint A

From the repository root:

```sh
npm run workbench
```

Open **http://127.0.0.1:5173** yourself. The command never opens a browser. The separate Remotion command remains `npm run dev`. Use Node 22.20.0 or newer; .n-node-version pins the installed version used for verification. With n, use `n exec auto npm run workbench` without changing your global Node selection. No runtime or browser was installed.

1. Open **Import lyrics**, choose either repository song `.ts`, raw `.txt`, or a workbench project `.json`. You can also paste lyrics. A successful import replaces the open project; download its JSON first if you want another copy. Failed imports retain the open project.
2. **Lyric editor** lists every unique phrase. Occurrence counts and timestamps are in the inspector; repeated occurrences share edits. Edit English, Polish, notes and word rows directly. Changes save in this browser; download JSON for a portable backup. JSON restores stable IDs, review status and approved segmentation. The old Python project JSON is a different format and is deliberately rejected rather than misread.
3. Select a word row, then **Split word** or **Merge with next** above the word table. A split requires a boundary between Hanzi characters. Readings are prefilled when the existing Pinyin aligns unambiguously; glosses are reused from matching project words when available. Review or edit these suggestions (blank drafts are allowed). A merge offers editable reading and meaning previews; confirm the compound meaning yourself. Grammar notes cannot be merged. The left token retains its ID; a split creates a fresh right token ID. Other tokens retain theirs. Both operations mark the phrase pending; **Undo/Redo** restores tokens, selection and review status. Phrase translations, occurrence order and timestamps stay intact.
4. Each lexical word has contiguous Pinyin: `piàoliang`, `xǐhuan`, `nǚ'ér`. The line preview joins different words with spaces. Imported manual data is never silently repaired. Use **Fix spacing** on a flagged row to correct that reading explicitly. Review also checks missing readings/glosses and Chinese character coverage. Parenthesized legacy tokens and empty-Hanzi notes survive export.
5. **Mark phrase reviewed** records review and segmentation approval once validation passes. Editing a sentence invalidates review without erasing segmentation approval. Editing word structure invalidates its approval. Save project JSON to retain workbench metadata; legacy TS carries only the renderer's established data contract.
6. **Export data** lists warnings and previews the actual TS. Download the legacy module, manually place/reference it under `src/`, and use the existing Remotion workflow. Missing raw timings remain null in JSON and become warned zero placeholders in a TS draft. Incomplete/unreviewed/invalid manual data requires explicit acknowledgement before draft download; it is never silently normalized. The app never overwrites source files.

Raw import currently strips headings and splits punctuation/newlines with stable deduplication; it preserves Traditional/Simplified text as authored. The existing Python OpenCC/Jieba/dictionary pipeline will be reused at checkpoint C, together with its per-word Pinyin prompt/postprocessing changes. There is no AI request or secret in this frontend. No audio/media is uploaded. Timing and Video settings explicitly describe their upcoming checkpoints; the text preview is labelled layout-only.

Browser recovery stores the current project, not the undo stack. History is bounded to 100 edits; source imports begin a new history. Reselecting a phrase preserves its committed edits. Save a portable JSON before clearing browser data. The browser's static TypeScript parser adds bundle size (roughly 11 MB unminified development JS); this avoids introducing an API/server merely for local file parsing.

## Verification

```sh
npm run workbench:check
npm run workbench:test
npm run workbench:build
npm run workbench:test:browser
npm run workbench:test:reference
npm run workbench:test:export
python-src/venv/bin/python -m pytest -q
```

Browser scripts use the already-cached Remotion headless shell. Set `WORKBENCH_BROWSER` to an existing compatible executable on another platform; they never download a browser. They run temporary loopback servers and stop them. Browser tests cover actual React file inputs/downloads, edits, split/merge, undo/redo, reload, failed import recovery and mobile layout. Screenshots land in ignored `out/workbench/`. The export render check substitutes only a generated temporary song in the bundle, then uses the unchanged LyricVideo2 component. Reference capture writes separate run directories under ignored `out/reference/`, a composition manifest and per-composition results. It returns failure if any capture fails.

The server-side reference helper’s native ffprobe aborts on footage captures because this macOS AVFoundation lacks `_AVCaptureDeviceTypeContinuityCamera`. Thumbnail and image/visualizer stills render successfully. This helper does not exercise the experimental Chrome/client-side renderer enabled in remotion.config.ts, which the owner uses successfully. Footage references must be verified through that configured path before renderer refactoring. Existing repository lint/type errors are documented in [the audit](../agent-docs/react-workbench/LOCAL_AUDIT.md).

The Wiktionary button opens an in-app dialog and follows a unique Chinese soft redirect, avoiding a second click from a Simplified stub to its Traditional lemma. The resolved page is shown in an iframe with Wiktionary’s own layout, styles and navigation. The dialog also offers a link to open it separately. Only that clicked word is queried against Wiktionary's public API. Multiple targets or lookup failures retain the original page. Imported text is never converted. Close or Escape dismisses the dialog.

The test suite also runs the real Python → TypeScript → React import regression when `python-src/venv/bin/python` exists; it reports that check as skipped otherwise. The web build scripts declare esbuild directly at the already-used locked version instead of relying on a transitive installation.

Current acceptance results, remaining gates and accepted UI review decisions are recorded in [CHECKPOINT_A.md](../agent-docs/react-workbench/CHECKPOINT_A.md). A passing automated suite is not a claim that every milestone in TEST_PLAN.md is complete.

All project tooling is TypeScript, executed directly by Node. `npm run workbench:check` checks both the frontend and Node scripts with strict TypeScript settings. `web/package.json` declares the web tooling as ES modules; `scripts/import-song.mts` explicitly marks the Python helper as a TypeScript ES module. No runtime loaders or CommonJS source wrappers are needed. The tests run natively through `node --test`, without a generated test bundle. The existing esbuild dependency is used only for the browser app build. To apply the pinned Node version to both Python and its Node subprocesses, run `n exec auto python-src/venv/bin/python -m pytest -q`.
