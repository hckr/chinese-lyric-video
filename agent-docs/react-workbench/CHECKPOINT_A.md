# Checkpoint A — implementation, review feedback and acceptance results

Updated 2026-11-13 against [TEST_PLAN.md](TEST_PLAN.md) and [WORD_SEGMENTATION.md](WORD_SEGMENTATION.md).

The React file workflow is implemented. **The complete M0/M1 acceptance checklist is not fully green:** the current footage reference script uses server-side rendering rather than the user’s configured Chrome/client-side workflow and fails in its native tool, and the combined frontend/Python Pinyin requirement is only satisfied on the frontend. Timing (B), Python integration (C), renderer consolidation (D) and settings-to-renderer integration (E) remain pending. These results do not imply completion of those milestones.

## Delivered functionality and boundaries

- Separate local React app under `web/`; `npm run workbench` serves loopback5173 without opening a browser. Existing Remotion commands, compositions, source songs and original Python proof of concept remain unchanged.
- Non-executing TypeScript AST import for both actual song modules, including shared const arrays, spreads, literal dictionaries and the supported `lines` getter. Both Python's `map(item => ...)` and parenthesized callback syntax are accepted. Executable/unsupported constructs, cycles and excessive expansion fail clearly.
- Unique phrases retain shared translations across ordered repeated occurrences. Imported metadata, timing, occurrence IDs, word order, Pinyin, multiline glosses and empty-Hanzi notes survive semantic TS round trips. Stable editor token identities and review/segmentation approval persist in versioned project JSON.
- Raw text/file import strips section headings, splits punctuation/newlines and deduplicates phrases while retaining repeats. New timings are null in JSON; draft TS uses warned zero placeholders. Traditional/Simplified text is retained as authored until Python normalization is integrated.
- EN/PL and token editing, contextual notes, move/add/remove, adjacent merge and Unicode-safe split, review validation, explicit spacing correction, undo/redo, browser recovery and separate TS/JSON downloads. Source files are never overwritten automatically.
- Split suggestions align the existing Pinyin only when unambiguous; gloss suggestions reuse unique matching project tokens. No pronunciation or character meaning is fabricated from a compound gloss.
- Wiktionary opens in a native in-app dialog containing the actual page in an iframe; a unique Chinese soft redirect is resolved on demand. No lookup occurs on selection. A separate-page link remains available. Offline tests mock the resolver and block the remote iframe document.
- The Python/Streamlit backend remains available independently. React has no AI API yet. Python project JSON and React project JSON remain distinct; explicit adapters, generation proposals and protection of manually approved segmentations are required at C.

Build configuration adds React DOM declarations and explicitly declares the already-installed esbuild0.28.1. No new browser/runtime or AI calls were used for acceptance. Node22.20.0+ now executes the TypeScript tooling/tests natively. There is no test bundle, runtime loader or Web Crypto shim. .n-node-version pins the verified installed runtime; `n exec auto` supplies it without changing the global Node selection.

## User review decisions retained for future work

These preferences take precedence over conflicting details in the design prototype:

- Focus on any word-row field selects that token. Removed selection radios; stable row numbers remain.
- Gloss fields grow/shrink with content, show up to three lines and scroll longer drafts.
- Personal notes are optional, collapsed, project-only reminders; excluded from videos and AI prompts.
- Removed the vague always-visible Pinyin instruction. Invalid spacing produces one actionable warning and an explicit Fix spacing action, without a duplicate character-format warning.
- Added padding around validation and separation from the review action. Enlarged the disclosure arrow and gave it a fixed rotation center so toggling does not shift the arrow or label.
- Split dialogs prefill readings where alignment is reliable, label each side with its Hanzi and keep all readings/glosses editable. Unavailable or ambiguous suggestions remain blank.
- Phrase-list subtitles show **both English and Polish**; search covers both languages.
- Removed the redundant “Shared lyric phrase” label and tightened the lyric hero padding/margins.
- Sentence fields remain single-line, with16px text. Preview Pinyin/translations are16px, Hanzi26px and caption11px.
- Desktop inspector is360px wide, with a responsive breakpoint that avoids squeezing the editor. “Dictionary lookup” replaces the misleading “Word reference”; Hanzi/Pinyin share a compact row, without copying the editable gloss.
- Browser popup-window requests were superseded by an in-app dialog, then the full Wiktionary iframe at the user's request. Preserve this final behavior rather than reintroducing the earlier popup or sanitized-article versions.
- The Wiktionary loading indicator is a small overlay badge inside the reserved iframe area. It must not consume layout space or move/resize the page when it disappears.

The UI follows the dark/blue design language but is **not a finished visual match** to the supplied mockups. Remaining design fidelity is unfinished work; intentional changes from this review are accepted product decisions. No pixel-equivalence claim is made.

## TEST_PLAN acceptance matrix — current run

Numbered rows correspond to checklist order within each section. **Partial** means the entire checkbox must remain open.

| Gate                                     | Result                            | Executed evidence / remaining work                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0.1 — inventory/preservation            | Pass                              | Rechecked working tree, index and commits; existing audit retained. Nothing staged/committed during this acceptance run.                                                                                                                                                                                                                    |
| M0.2 — compositions/assets/contracts     | Pass                              | Runtime enumeration confirms all seven original IDs, sizes, FPS and durations; inventory in LOCAL_AUDIT.md.                                                                                                                                                                                                                                 |
| M0.3 — references across families        | Partial / capture method mismatch | All three thumbnails and image+visualizer frame render through the server-side capture script; footage fails in that script’s bundled ffprobe. This does not test the user’s working Chrome/client-side rendering path. Capture references with that configured path before closing this gate.                                              |
| M0.4 — documented workflows/no loss      | Pass                              | Python69 tests pass; render commands/results recorded; `git diff 677159d -- src python-src/translate.py` is empty.                                                                                                                                                                                                                          |
| M1.1 — two real imports/static safety    | Pass                              | Keep Walking and Macchiato semantic imports; const references/spreads/Hanzi keys/getter; invalid expressions rejected; browser failed import retains open edits.                                                                                                                                                                            |
| M1.2 — legacy/project round trips        | Pass                              | Whole-song semantic metadata/dictionary/timeline round trips, notes/multiline glosses; actual Python exporter output imported in React. Browser JSON download/reopen preserves approved segmentation/IDs; TS download/reimport preserves occurrences.                                                                                       |
| M1.3 — UI merge/split/review/undo        | Pass                              | Actual browser workflow merges 漂+亮 into 漂亮/piàoliang with edited gloss, then splits with editable readings/glosses. Note retained; review invalidated; undo/redo and approval/JSON recovery verified.                                                                                                                                   |
| M1.4 — Pinyin frontend AND Python        | Partial / backend pending         | Frontend tests cover piàoliang, spaced inter-word display, explicit manual-spacing correction, apostrophes/ü/tones/notes. A direct Python probe confirms `Word(...pinyin="piào liang")` still passes vocabulary validation unchanged. Prompts/postprocessing/response validation need the C changes before this combined checkbox can pass. |
| M1.5 — segmentation independence         | Pass                              | Domain and browser checks retain phrase EN/PL, occurrence IDs/order/exact timing, unrelated token/note identity and phrase text across merge/split.                                                                                                                                                                                         |
| M1.6 — repeats/shared edit               | Pass                              | Real songs retain repeats; browser fixture resolves two timed chorus occurrences to one phrase, and editing that phrase yields the same translation for each occurrence.                                                                                                                                                                    |
| M1.7 — raw repetitions/unassigned timing | Pass                              | Browser imports `[Verse]` plus three lyric lines with a repeat:2 phrases,3 ordered occurrences, null boundaries and visible unassigned export warnings.                                                                                                                                                                                     |
| M1.8 — consumer types/old render         | Partial                           | Both exports typecheck against LineData read from all four actual video components. Edited generated Macchiato TS renders through unchanged LyricVideo2 via bundle-only module replacement. Footage verification through the user’s Chrome/client-side rendering path is still pending; no direct source overwrite was performed.           |

M2–M5 are **not due / not implemented** as complete workflows. Preservation of exact imported milliseconds and shared phrase mapping is already exercised by M1, but this does not prove audio-clock synchronization, timing controls, AI integration, audio single-source playback, preset equivalence or preview/render configuration. No live generation/evaluation calls were made.

## Commands and observed results

- `node web/tests/run.ts` on installed Node22: **24 passed,0 skipped**. Includes actual Python→TS→React interop and consumer type checks.
- Before the native-TypeScript conversion, the CommonJS test harness also passed24 tests with global crypto removed. That fallback has since been removed together with Node18 support at the owner’s request; it is not a claim about the current harness.
- `python-src/venv/bin/python -m pytest -q`: **69 passed**, one existing pkg_resources deprecation warning.
- `tsc -p web/tsconfig.json`, web ESLint, `node web/dev.ts --build`, `git diff --check`: **passed**.
- `node web/tests/browser.ts`: **passed**, extended with the exact M1 segmentation/JSON/raw-import workflows described above. Uses an existing cached headless browser and a temporary loopback server; no browser download or paid API call. Screenshots were inspected at `out/workbench/review.png` and `mobile.png`.
- `node web/tests/render-export.ts`: **passed**. Inspected `out/workbench/export-check-N8SnU9/edited.png`, showing “Workbench export verified” in the unchanged Macchiato renderer at frame100. Generated Song.ts and bundle are in that ignored directory.
- Reference helper (last full capture was before its TypeScript rename): **exit1**, with explicit per-composition results under `out/reference/1794540134586/`. Thumbnails at frame0 and LyricVideo2 at frame500 passed. LyricVideo/LyricVideoOnlyPinin at frame500 and LyricVideoShort at frame100 failed. Original references from prior runs remain retained.
- Root ESLint: **fails** on existing unused `useId` imports in LyricVideo.tsx/LyricVideoOnlyPinin.tsx. Root tsc: **fails** on those imports and missing resolveJsonModule for Lottie JSON imports. Web checks pass independently; these renderer files were not changed.

The footage failure is SIGABRT in the reference script’s server-side Remotion native ffprobe/libavdevice because macOS AVFoundation lacks `_AVCaptureDeviceTypeContinuityCamera`. The script calls Node renderStill, whose configuration is not automatically read from remotion.config.ts. That repository config explicitly enables experimental client-side rendering, which the user reports works well in Chrome. The failed native capture is therefore a test-method limitation, not evidence that the user’s rendering workflow is broken. No browser, OS, native binary or renderer behavior was changed. Full intro/active/repeat/long-line/outro coverage and actual comparisons remain required before D. Initial still captures do not verify full video audio behavior.

## Changed files and next step

The pending React change consists of `web/` application/domain/adapters/styles/tests/tooling/docs, root package manifests and web-project exclusion in root tsconfig, the web-output ignore rule, root README and this checkpoint report. This acceptance pass adds browser coverage and replaces the previous chronological report with current behavior, review decisions and traceable gate results. It does not modify the already-committed design specs, Python backend, renderer or source songs.

Before calling all M0/M1 gates complete, resolve or explicitly carry forward the two partial areas: footage reference/render verification through the configured Chrome/client-side path and the Python part of the Pinyin contract. B remains the next implementation checkpoint; C must retain Python logic and preserve manually approved segmentation. No staging or commit was performed.

## Clarifications from the owner

- `src/Angela_Zhang_Keep_Walking.ts:576` contains the published, manually authored `bù qīng`. Preserve that file and historical data unchanged. Imported manual Pinyin must not be silently rewritten; explicit editor correction applies only to the working project. The future contiguous-word contract applies to new generation/edits, and the outstanding Python probe concerns a **new** 漂亮/piào liang word, not a demand to modify the published song.
- The user uses the experimental Chrome/client-side renderer successfully; the ordinary renderer was previously avoided for speed, not because their workflow was broken. Future footage acceptance captures should use the configured client-side path, rather than declaring the product blocked based on the SSR still-capture helper.
- “Root lint/typecheck failures” means static developer checks over `src/` launched from the repository root: unused useId imports and TypeScript JSON-module configuration. It does not mean a Remotion playback or render failure. These checks and actual rendering are separate evidence.

## Native TypeScript tooling conversion

All six CommonJS source scripts were converted: `web/dev.ts`, `web/tests/run.ts`, `browser.ts`, `reference.ts`, `render-export.ts`, and `scripts/import-song.mts`. The `.mts` extension explicitly identifies the standalone Python helper as an ES module; `web/package.json` supplies that boundary for the web tooling. Python helper invocations/tests now use the new path. npm scripts and current usage docs were updated. The initial LOCAL_AUDIT entry retains its original historical filename.

The existing Node22.20.0 runtime is selected with `n exec auto` and recorded in .n-node-version/package engines. No runtime installs, TypeScript loaders or CommonJS wrappers are used. Runtime imports use explicit TypeScript extensions and type-only imports; the syllable JSON import has its native JSON attribute. A separate strict tools tsconfig now checks all converted helpers and the domain tests. @types/node is explicitly declared at the version already installed/locked. Root Remotion typechecking excludes this separately checked tooling.

The domain runner now invokes Node's native TypeScript test runner directly. The export-render helper imports the actual TypeScript adapter rather than emitting/loading a temporary CommonJS adapter. Browser helpers have explicit project/download/result/DOM types and real Response mocks. Generated render bundles remain ordinary build artifacts, not source scripts.

Conversion verification: native `n exec auto npm run workbench:test` passes24 tests with no skips; `n exec 22.20.0 python-src/venv/bin/python -m pytest -q` passes69 tests; frontend/tools strict checks, expanded source/tooling lint and app build pass. The converted browser helper passes the full M1 acceptance flow, and the converted export-render helper produces `out/workbench/export-check-O51pxo/edited.png`. The reference helper is type-checked; its previously documented SSR capture limitation remains, and it has not been claimed as a new Chrome/client-side verification. No files staged or committed.

## Repository formatting setup

Prettier3.8.1 and Ruff0.17.5 now have checked-in project configuration: expanded `.prettierrc`, `.prettierignore`, `ruff.toml`, and shared `.editorconfig` defaults. npm exposes combined apply/check commands and separate web/Python commands. Ruff is pinned in Python development requirements; Prettier was already pinned. No hooks were installed and nothing was staged.

Pending React/tooling source and current usage docs were formatted. Published song modules and visual prototype snapshots are excluded from Prettier; the original Python proof of concept and virtualenv are force-excluded from Ruff. Generated/local data and tool caches are excluded. Ruff is restricted to Python source so Markdown remains owned by Prettier.

Validation: frontend/tools typechecks pass; formatter exclusions were checked; Ruff previews preserve the Python AST for14 files without writing them; pip check passes. Repository-wide formatting checks intentionally still report existing style differences in11 committed design/roadmap documents and13 Python files. Those were not bulk-reformatted into the feature diff. This setup does not claim formatting checks are already green across historical files.

## Changed/staged-file formatting

Added native TypeScript `scripts/format-changes.mts` and npm commands `format:changed`, `format:staged` plus their read-only `:check` counterparts. Changed selection combines staged, unstaged and untracked paths; staged selection takes only index paths. Both format working-tree copies and never stage files or update the index. Paths are read with Git NUL separators and passed without shell interpolation. Deleted files, symlinks, ignored and unsupported files are skipped; Prettier/Ruff exclusions remain in force.

Ran `format:changed` before staging: current React/tooling/docs are consistent, and the two already-modified Python files (`songs.py` and `test_workbench.py`) were reformatted. The untouched historical backend/design files remain outside this changed-file pass; published songs and the original proof of concept remain unchanged. Changed-file formatting check passes. Three temporary-repository tests verify selection, spaces in filenames, ignored files, preservation of partially staged index content, read-only checks and idempotence. Current total:27 Node tests and69 Python tests pass; strict frontend/tools checks and targeted tooling lint pass. No files staged or committed.

### Development workflow follow-up

- Added an opt-in checkout installation command (`npm run hooks:install`) for the versioned formatting pre-commit hook. It checks staged Git blobs with Prettier/Ruff, leaves partial staging intact, and blocks unformatted commits. Enabled in this checkout; no files staged or committed.
- Added development-only React browser refresh using esbuild live-reload events, without opening a browser. An isolated browser test verifies actual source changes refresh the React page and the saved project survives. Production builds omit the reload client.
- Verification: 31 automated tests passed, including real hook rejection/acceptance in a temporary repository and staged Python checks; live-reload browser test, workbench TypeScript checks, production build and targeted ESLint passed.

Test artifact lifecycle: reference/export render helpers now remove disposable bundles in `finally`, including setup/render failures. Review frames and reports remain until `npm run workbench:clean` removes the two test-owned directories (`out/workbench`, `out/reference`); videos and thumbnails outside them are preserved. Historical evidence paths above may therefore no longer exist after explicit cleanup.

### Review fixes: Pinyin, headings and partial staging

- Review validation now parses Mandarin syllable sequences from the shared Python syllable inventory and compares possible syllable counts with Hanzi counts. It accepts neutral tones, syllabic nasal tones (including decomposed `n̄`), apostrophes, legacy parenthetical punctuation and erhua. Invalid sequences, placeholders and count mismatches produce warnings and prevent marking a phrase reviewed. Published song data remains unchanged.
- Raw import strips whole-line `主歌` and `副歌` headings like the established Python importer, retaining repeated lyric occurrences without exporting headings.
- Staged formatting checks reject formatter configuration mismatches between the index and working tree, including untracked configuration and nested overrides. This prevents unstaged ignore/configuration edits from bypassing the check.
- Regression verification: all 38 automated tests, frontend/tools TypeScript checks, production build and targeted ESLint passed. No staging or commits.
