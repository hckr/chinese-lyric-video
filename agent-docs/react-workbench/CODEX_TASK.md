# Codex task — integrated React / Python / Remotion migration

## Mandate

Implement `agent-docs/react-workbench/ROADMAP.proposed.md` as a **gated migration** to a React lyric editing and timing workbench, reusing the local Python AI pipeline and consolidating Remotion compositions only after baselining. The HTML is a UI reference, **not** application code. Preserve manual TypeScript export and the existing Remotion pipeline for the first operational milestone.

Read in order:
1. `README.md`
2. `ARCHITECTURE.md`
3. `TIMING_EDITOR.md`
4. `REMOTION_REFACTOR.md`
5. `UI_SPEC.md`
6. `WORD_SEGMENTATION.md`
7. `TEST_PLAN.md`
8. `ROADMAP.proposed.md`
9. Open `lyric-workbench-design.html` locally for visual reference (dark mode, blue accent, including Timing and Video settings screens).

## Absolute first actions — inventory and preservation

1. Inspect `git status --short`, `git diff`, staged changes, and relevant untracked files. **The user has a working but uncommitted Streamlit implementation.** Treat it as valuable, authoritative local code, not disposable prototype. No `git reset --hard`, `git clean`, unrequested stash, broad automatic overwrites or removal of Streamlit/Python files.
2. Read repository README, package scripts, Remotion root/registered compositions, existing song TS modules (especially `src/Angela_Zhang_Keep_Walking.ts`), Python scripts, Streamlit UI and tests. Inspect exact current dependency versions and audio/visualizer implementation.
3. Produce a short **inventory report** `agent-docs/react-workbench/LOCAL_AUDIT.md` with: existing modes/composition IDs/dimensions/FPS, assets and audio source; named duplicated blocks and genuine behavioral differences; Python functions worth reusing; local files at risk; relevant changes to the roadmap proposal.
4. Merge—not replace blindly—`ROADMAP.proposed.md` into the local `agent-docs/ROADMAP.md`, preserving existing completed work/notes and accounting for code that exists locally but not on GitHub.
5. Identify a baseline render or screenshot capture strategy using *existing* commands/tools. Do not install Chrome or other browser just to capture samples. A small representative frame set per mode and thumbnail is enough to begin.

**If a requirement conflicts with current local code, prefer preserving behavior and note a specific decision in `LOCAL_AUDIT.md`, rather than silently redesigning it.**

## Implementation order (work in checkpoints, not all at once)

### Checkpoint A: React MVP — file workflow

- Add a separate `web/` app using existing tooling where possible; give it a distinct launch command without changing Remotion `npm run dev` semantics.
- Implement real import of `.txt` and legacy song `.ts`, safe TS AST interpretation (no executing user-supplied source), phrase review, word breakdown editing **including adjacent-word merge and single-word split**, stable IDs, review metadata, and original order/repetition semantics. Implement the exact UX and validation in `WORD_SEGMENTATION.md`; per-word Pinyin must be unspaced (`piàoliang`, not `piào liang`), with spaces only between distinct tokens when rendering a whole lyric.
- Manual export: valid legacy TS song module **and** versioned project JSON. Preserve imported `TIMELINE` `startMs/endMs`, occurrence IDs, references and words. Warn on absent timing, but no silent auto-sync.
- Add validation and import → export → re-import tests using at least two real song modules. Test generated TS against actual consumer types. Verify old Remotion command still works.

**Checkpoint A done when:** existing songs can be edited in React and manually copied back into `src/` without breaking rendering. Do not redesign song storage prematurely.

### Checkpoint B: Timing editor — practical timing workflow

- Implement `TIMING_EDITOR.md`: one row per **occurrence**; audio load/playhead clock, visual timeline, waveform peaks where available, dragging and edge trimming, precise millisecond fields, tap-to-sync (`S`, `E`), nudge, seek, undo/redo, clear gap/overlap indicators.
- Use existing audio handling where useful. Audio/video playback has exactly one master clock and one soundtrack. Keep real media files local unless user explicitly triggers an API.
- Persist project JSON, export original `startMs/endMs` integers and order exactly. An edit to an occurrence must never change the translation of its phrase or unrelated instances.

**Checkpoint B done when:** user can align a repeated chorus by listening in the workbench, export TS and preview in old Remotion Studio without hand-editing numeric timestamps.

### Checkpoint C: Python AI/NLP integration

- Reuse the locally implemented Streamlit/backend parsing, OpenCC, Jieba, CC-CEDICT, prompting and LLM code; identify its actual structure first. Separate backend logic from Streamlit widgets, introduce a minimal local API if required (prefer existing dependencies).
- Add per-unique-phrase generation, dictionary evidence and assisted revision to React. Store provider/model/prompt provenance, preserve edits on failures, keep secrets server-only. Update the *existing* AI prompts/postprocessing to return **one contiguous tone-marked Pinyin string per word**; accept/review AI segmentation suggestions without silently replacing manual merge/split decisions. Add server-side validation for Pinyin whitespace and regressions against previous manually translated files. API calls are opt-in and should not happen on every keystroke.

**Checkpoint C done when:** user can generate a draft, correct it, preserve occurrence timing, and export; Streamlit's useful backend logic is retained.

### Checkpoint D: Remotion cleanup and configuration model

- First capture reference frames/behavior for *all actual* music-video, still-image/visualizer and thumbnail variants. Keep each registered ID, duration logic, FPS, ratio, audio behavior and text layout.
- Refactor in small stages under `REMOTION_REFACTOR.md`: extract text/timing and style primitives, then background strategies, overlays/outro, thumbnail helpers. Use compatibility entrypoints and typed preset defaults to avoid visual regression.
- Expose meaningful config: background mode, media refs, visualizer style/colors/opacity/intensity, fit/blur, lyric size/visibility, overlay/outro where justified. Keep internal animation math and FPS configuration controlled. Do **not** force thumbnails into a video abstraction.
- Verify no doubled audio in music-video case and no silent change in visualizer behavior. Use render comparisons with documented acceptable nondeterminism.

**Checkpoint D done when:** the duplicated code is reduced without breaking existing Remotion output and all existing variants remain callable.

### Checkpoint E: UI → Remotion preview / render

- Connect Video settings to the same composition/preset resolver used by final Remotion renders. Use a real Remotion Player when practical; first check installed dependencies.
- Use the editor's selected occurrence/playhead position in preview, and reconcile timebase conversion with the real renderer.
- Keep the manual TS export path. Optional direct rendering, asset-path assignment and file-system writes must be explicit, opt-in features, not implicit side effects of opening or editing a project.

**Checkpoint E done when:** changing visualizer color/background mode visibly affects both preview and actual rendered output while preserving timing.

## Hard constraints

- Prefer code already present. **Do not install additional browsers, runtimes, system tools or unrelated dependencies.** Explain any genuinely necessary package before adding it. Do not invent a server if file import and local audio already work without one.
- No direct execution of imported `.ts`. An unsupported expression should produce a clear error, preserving the open workbench state.
- Preserve imported timestamps exactly unless user explicitly adjusts them. In editor, use integer milliseconds; don't quantize imported values to frame boundaries.
- Preserve user edits, uncommitted work, formatting where possible and existing Remotion composition registration. No destructive cleanup by default.
- Never silently regenerate manually reviewed AI translations, reassign phrase IDs, erase repeated timeline occurrences, overwrite manually approved word segmentation, or normalize away contextual grammar-note tokens. Never silently modify imported manually authored Pinyin; offer explicit correction for invalid per-token whitespace.
- Keep local audio/video/images out of automatic network requests and avoid hardcoding absolute user paths in exported song modules.
- Maintain meaningful accessibility: keyboard timing controls must be disabled while text inputs are focused; playhead and handle controls must be keyboard reachable.

## Required reporting at each checkpoint

Provide (a) files changed; (b) design choices and deviations from this proposal; (c) which Python/Streamlit code was preserved; (d) any added dependencies and why; (e) tests and reference renders actually performed; (f) known differences and next milestone. If a checkpoint is unfinished, say so and leave existing user workflows usable.

## Acceptance suite

Follow `TEST_PLAN.md`. Key tests: actual TS round trip, **merge/split word round trips and `piàoliang` Pinyin convention**, one phrase → multiple occurrence independence, waveform/audio clock, `S`/`E` capture, saved millisecond accuracy, default visual equivalence across both background modes, thumbnail variants, exact composition IDs, audio single-source and adjustable visualizer colors reflected in real render.
