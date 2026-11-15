# React Lyric Workbench — file editing and timing

From the repository root:

```sh
npm run workbench
```

Open **http://127.0.0.1:5173** yourself. The command never opens a browser. The separate Remotion command remains `npm run dev`. Use Node 22.20.0 or newer; .n-node-version pins the installed version used for verification. With n, use `n exec auto npm run workbench` without changing your global Node selection. No runtime or browser was installed.

1. Open **Import lyrics**, choose either repository song `.ts`, raw `.txt`, or a workbench project `.json`. You can also paste lyrics. A successful import replaces the open project; download its JSON first if you want another copy. Failed imports retain the open project.
2. **Lyric editor** lists every unique phrase. Occurrence counts and timestamps are in the inspector; repeated occurrences share edits. Edit English, Polish and word rows directly. Changes save in this browser; download JSON for a portable backup. JSON restores stable IDs, review status and approved segmentation. The old Python project JSON is a different format and is deliberately rejected rather than misread.
3. Select a word row, then **Split word** or **Merge with next** above the word table. Choose a Hanzi boundary for splitting and review the editable readings/glosses before confirming. **Undo/Redo** restores the previous edit. See [the segmentation contract](../agent-docs/react-workbench/WORD_SEGMENTATION.md) for identities, preservation and Pinyin rules.
4. Use **Fix spacing** on a flagged row to correct that reading explicitly. Review warnings identify missing/invalid readings, glosses and Chinese character coverage.
5. **Mark phrase reviewed** records review and segmentation approval once validation passes. Editing a sentence invalidates review without erasing segmentation approval. Editing word structure invalidates its approval. Save project JSON to retain workbench metadata; legacy TS carries only the renderer's established data contract.
6. **Export data** lists warnings and previews the actual TS. Download the legacy module, manually place/reference it under `src/`, and use the existing Remotion workflow. Missing raw timings remain null in JSON and become warned zero placeholders in a TS draft. Incomplete/unreviewed/invalid manual data requires explicit acknowledgement before draft download; it is never silently normalized. The app never overwrites source files.

Raw import uses the local Python OpenCC/Jieba/CC-CEDICT pipeline to simplify Chinese text, strip headings/credits and draft word readings/glosses while preserving repetitions. English/Polish sentence translations remain manual. There is no paid AI request or browser API key. No audio/media is uploaded. Video settings and synchronized Remotion Player integration remain later checkpoints.

Browser recovery stores the current project, not the undo stack. History is bounded to 100 edits; source imports begin a new history. Reselecting a phrase preserves its committed edits. Save a portable JSON before clearing browser data. The browser's static TypeScript parser adds bundle size (roughly 11 MB unminified development JS); this avoids introducing an API/server merely for local file parsing.

## Timing workflow (checkpoint B)

1. Open **Timing** after importing a song or raw lyrics. **Lyrics** lists every timed appearance, including repeats. Select a sidebar row or timeline block to seek to its start, both paused and playing. In the lyric editor, each appearance has a **Timing** button that opens its own timing selection; **Translate** returns to the shared phrase editor.
2. Choose local audio, or a supported video container used only for its soundtrack. The picker shows **No audio selected** until loaded, then the filename beside **Replace audio**. One native audio element owns playback and `currentTime`; no media is uploaded. Playback speed, loop selection, the labelled seek slider and ruler/waveform clicks use that clock.
3. Enter integer **Start/End milliseconds** and click **Apply timing**, or press **S/E** to capture the current playback position. Empty fields are unassigned. For a raw cue capture start then end. To move an existing interval beyond its end, edit both fields together or set the end first. Negative, fractional, zero-length and past-duration edits retain the last valid interval and show an error. Overlaps are allowed as drafts with warnings.
4. Drag a cue body to move it or an edge to trim. Previews and committed drops may overlap other cues; overlapping drafts show warnings. A successful drag is one undo step. Moves preserve duration, media bounds are enforced, and other appearances, phrase review and segmentation remain unchanged. Imported overlaps remain intact and are flagged; ordinary gaps are not warnings.
5. **Zoom** starts at **8×**. Zoom keeps the playhead visible, or anchors the selected cue without audio. **Snap** defaults to **Neighboring edges**, within 100 ms; Off remains available. No frame-rate or beat snapping is exposed, and imports are never quantized.
6. While paused, drag the timeline background with the hand cursor to pan. Clicking without dragging seeks. At 1× the entire song is visible. During playback, horizontal panning is locked and follow scrolls after the playhead passes **15/16** of the visible width, placing it at **1/16**, clamped at song boundaries. Pausing stops any ongoing follow animation and restores panning.
7. Selecting a lyric reveals it in both panels. The fixed-height preview and equal-width Previous/Next/Translate buttons keep navigation steady. **Undo/Redo** stays in the sticky workspace header. Programmatic selection, zoom and follow scrolling use the native smooth-scroll API; hand-panning stays immediate.
8. Focus a cue body/edge and use ←/→ for 10 ms, Shift for 100 ms. Elsewhere, Space plays/pauses; S/E captures boundaries; ←/→ seeks 100 ms, Shift 1 s; Alt+←/→ adjusts the last selected target by 10 ms, Shift 100 ms; `[`/`]` selects the previous/next lyric. Keyboard adjustments permit overlaps with warnings.
9. **Reset timing for this lyric** restores only the selected appearance's import snapshot and is undoable; overlaps remain allowed as warned drafts. Older project JSON without a snapshot uses its current timing as the baseline when first opened in this version.
10. Save project JSON or download legacy TypeScript as before. JSON stores original timings and lightweight audio filename/size/modified-time/duration metadata, never media bytes, absolute paths or object URLs. Reloading requires selecting audio again; leaving Timing pauses playback. Choosing audio is independent of edit history, so Undo/Redo retains metadata for the currently selected file. Legacy TS exports exact ordered IDs and integer timestamps, with warnings for missing/invalid/overlapping timing or intervals beyond the saved audio duration.

Waveforms are computed locally from decoded PCM, with at most 1,600 peak bins. Files over 32 MiB or eight minutes skip analysis to limit memory use; playback and ruler editing remain available. Decode failures likewise fall back to the ruler. Progress/failure notices appear when relevant, without redundant waveform labels. Unsupported media retains project edits and reports an error.

The JSON schema remains version 1 with optional validated `audio` and `timingBaseline` fields. Existing version-1 projects load; older strict workbench versions may reject files with these new fields. Legacy TS omits workbench metadata. The text preview is layout only; Remotion media assignment and rendering remain explicit manual steps.

Beat detection is deferred after the fixed-tempo experiment proved unreliable on real music. Future assisted alignment against supplied lyrics is planned in [ASSISTED_TIMING.md](../agent-docs/react-workbench/ASSISTED_TIMING.md).

## Application versioning

The root `package.json` version is the single source of truth, starting at
`0.1.0`. The React navigation imports it directly and displays `v` followed by
that version beneath “Lyric Workbench” across all workspaces, including before
import. Keep the top-level and root-package versions in `package-lock.json`
synchronized when changing it.

- Use Conventional Commits for commit messages: `type(scope): description`
  (scope optional). Use `feat` for features, `fix` for bug fixes, and `docs`,
  `test` or `refactor` for those changes. Version bumps follow the
  accepted-task rules below; commit types do not trigger automatic releases.
- Accepted feature: increment minor and reset patch (`0.1.1 → 0.2.0`).
- Accepted bug fix or small improvement: increment patch (`0.2.0 → 0.2.1`).
- Documentation, tests and internal refactoring alone: no bump.
- Include at most one bump per accepted task in its reviewable changes. Mixed
  feature/fix tasks receive a minor bump.
- Major-version changes require an explicit decision. Do not add a release
  process, publishing, tags or automation unless explicitly requested.

## Verification

```sh
npm run workbench:check
npm run workbench:test
npm run workbench:build
npm run workbench:test:browser
npm run workbench:test:reference
npm run workbench:test:export
# After browser acceptance, render its actual timed download:
npm run workbench:test:export -- --song out/workbench/timed-export.ts
python-src/venv/bin/python -m pytest -q
```

Browser scripts use the already-cached Remotion headless shell. Set `WORKBENCH_BROWSER` to an existing compatible executable on another platform; they never download a browser. They run temporary loopback servers and stop them. Browser tests cover actual React file inputs/downloads, edits, split/merge, undo/redo, reload, failed import recovery and mobile layout. Screenshots land in ignored `out/workbench/`. The export render check substitutes only a generated temporary song in the bundle, then uses the unchanged LyricVideo2 component. Reference capture writes separate run directories under ignored `out/reference/`, a composition manifest and per-composition results. It returns failure if any capture fails.

The server-side reference helper’s native ffprobe aborts on footage captures because this macOS AVFoundation lacks `_AVCaptureDeviceTypeContinuityCamera`. Thumbnail and image/visualizer stills render successfully. This helper does not exercise the experimental Chrome/client-side renderer enabled in remotion.config.ts, which the owner uses successfully. Footage references must be verified through that configured path before renderer refactoring. Historical static-check limitations are recorded in [TEST_PLAN.md](../agent-docs/react-workbench/TEST_PLAN.md).

The Wiktionary button opens an in-app dialog and follows a unique Chinese soft redirect, avoiding a second click from a Simplified stub to its Traditional lemma. The resolved page is shown in an iframe with Wiktionary’s own layout, styles and navigation. The dialog also offers a link to open it separately. Only that clicked word is queried against Wiktionary's public API. Multiple targets or lookup failures retain the original page. Opening Wiktionary does not change the project text. Close or Escape dismisses the dialog.

The test suite also runs the real Python → TypeScript → React import regression when `python-src/venv/bin/python` exists; it reports that check as skipped otherwise. The web build scripts declare esbuild directly at the already-used locked version instead of relying on a transitive installation.

Remaining checks and known issues are listed in [TEST_PLAN.md](../agent-docs/react-workbench/TEST_PLAN.md). A passing automated suite does not establish completion of every milestone.

All project tooling is TypeScript, executed directly by Node. `npm run workbench:check` checks both the frontend and Node scripts with strict TypeScript settings. `web/package.json` declares the web tooling as ES modules; `scripts/import-song.mts` explicitly marks the Python helper as a TypeScript ES module. No runtime loaders or CommonJS source wrappers are needed. The tests run natively through `node --test`, without a generated test bundle. The existing esbuild dependency is used only for the browser app build. To apply the pinned Node version to both Python and its Node subprocesses, run `n exec auto python-src/venv/bin/python -m pytest -q`.

### Real-song import regression

Run `npm run workbench:test:cat-song-workflow` for the supplied 做你的猫 fixture. It starts its own temporary loopback server and isolated browser, reuses the installed browser without downloads, and calls only the local Python dictionary importer. It checks title/credit removal, all 73 appearances in order, 22 unique lyrics, word coverage/Pinyin, editing/reload, insertion/repeats/removal/Undo, action alignment, JSON reopen and TypeScript draft export. Disposable results go to `output/playwright/cat-song-workflow/`. It leaves the running development server and your browser project alone.

Name future test commands after their concrete scenario or workflow; avoid vague names such as `test:raw`.

The dictionary sidebar looks up the selected word on demand through the local Python service using `public/cedict_1_0_ts_utf-8_mdbg.txt`. Results are cached in memory (up to 200 words), separately from editable Pinyin/glosses. Dictionary definitions are never saved in project JSON or renderer TypeScript; older JSON references are discarded on load. This works for legacy TS songs as well as raw imports, with no API credentials or external dictionary requests. Restart `npm run workbench` after updating server routes. Removal uses an in-app confirmation, with Undo available.

### Repeats and chorus groups

The Lyric editor's **Add lyric** inserts new shared text. Existing lyrics can be repeated only in **Timing → Repeat**; each repeat starts at the original’s timestamps (with an expected overlap warning) and shares translations. Move it on the timeline. Untimed originals produce untimed repeats. Use timeline dragging to move a timed lyric.

Use **+ Group** beside Lyrics to start from the selected ungrouped lyric, revealed in the list. If it already belongs to a group, choose a first lyric. Hover previews an inclusive range with First/Last labels; clicking the endpoint locks it. **Adjust range** reopens endpoint selection. Existing groups cannot be crossed. Enter a name (initially empty) and choose Create; Cancel/Escape leaves the original selection unchanged. A group must have at least two members. Membership stays fixed; **Ungroup** retains its lyrics, while **Delete group** confirms removal of its appearances. The sidebar's **…** menu also offers Rename and Duplicate. Group headers aggregate warnings even when collapsed.

Click a group's arrow/name to collapse it. Choose a member to emphasize its group. Sidebar rows do not drag: move the passage with its timeline rail handle, or move/trim an individual block.

Choose **Duplicate…**, position the ghost with its own handle, edit the name and click **Create copy**. Dragging only previews the copy; Cancel/Escape discards it. Playback pauses and other edits are inactive while passive timeline panning remains available. Overlap warnings do not prevent confirmation. Each committed move/copy is one Undo operation.

The [grouping contract](../agent-docs/react-workbench/features/lyrics-grouping/SPEC.md) defines ordering, membership, warnings, duplication and persistence.

Run `npm run workbench:test:lyrics-grouping` for the dedicated spec acceptance scenario. Its implementation is `web/tests/lyrics-grouping.ts`; disposable screenshots and results go to `output/playwright/lyrics-grouping/` and are covered by `npm run workbench:clean`. It uses the existing installed browser and a temporary local server, without modifying the running development server or your browser project.

Timeline rows stay fixed during a drag and compact after a drop. Selection reveals the block in both axes; view layout is not saved in project files. Detailed layout behavior and executable checks are linked from the grouping contract.
