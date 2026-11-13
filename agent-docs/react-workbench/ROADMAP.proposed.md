# Chinese Lyric Video — Proposed integrated roadmap (v2.1)

> **Proposal, 2026-11-12.** Merge with the **actual local** `agent-docs/ROADMAP.md`. The local uncommitted Streamlit implementation and the currently registered Remotion files were not available to this document's author. Codex must inspect them before finalizing the roadmap or deleting/moving anything. This file replaces the previous workbench-only roadmap proposal.

## Destination

One local-first **React Lyric Workbench** for Chinese-language lyric videos with EN/PL translations, word glosses, **manual timing**, media/background settings and preview, built around the existing **Python translation backend** and **Remotion renderer**.

**Keep manual export as an end-to-end path:** import raw lyrics or existing `.ts` → edit language + timestamp occurrences → choose visual preset → export `.ts` and optional project JSON → place output into `src/` manually → run Remotion. Later the workbench can preview/render without manual steps.

### Product screens

1. Import — raw `.txt` or legacy song `.ts`, metadata, deduplication and validation.
2. Translate — one review entry per unique lyric phrase; AI proposals later.
3. Timing — one editable cue per ordered occurrence; local waveform/audio playback.
4. Video — footage vs image+visualizer; named presets and small visual overrides.
5. Export — compatibility `.ts`, separate versioned project JSON, readiness diagnostics.

### Shared domain decisions

- `phraseId` is stable in the editor; repeated chorus occurrences reference it independently.
- `TIMELINE` remains ordered and allows repeated keys; each occurrence has its **own** timing.
- Keep existing TypeScript format compatible; do not execute imported TS code.
- Workbench project JSON stores things not represented in the legacy song module (review metadata, media references, visual config, nullable timestamps).
- Preserve all current video and thumbnail composition IDs, outputs and assets until the refactor passes regression tests.
- Single active soundtrack: music-video vs image mode must not accidentally double audio.
- Settings follow safe defaults → named preset → sparse overrides, not arbitrary JSX/CSS exposed everywhere.

## Milestones and acceptance gates

### M0 — Inspect and protect local work (required before implementation)

- Capture `git status`, inspect staged/unstaged/untracked Streamlit/Python changes and user modifications; never reset/clean/stash without explicit consent.
- Inventory Remotion composition IDs, file paths, rendering modes, audio routing, variants and thumbnails.
- Record baseline commands and capture representative video frames + thumbnails before refactor.
- Reconcile the existing roadmap and local code with these documents. Produce a concise architectural inventory and any deviations from suggested file organization.

**Gate:** no source lost; composition matrix and reusable Python functionality documented.

### M1 — Functional React import → translation editor → manual TS export

- New `web/` React + TypeScript app. Dark blue-accent UI matches supplied HTML reference.
- Safe static AST import of actual legacy `.ts` song modules (supported constructs only; loud errors on unsupported syntax) and raw lyric import.
- Translation editor: English, Polish, Pinyin, token glosses, grammar notes, per-phrase review; **word merge/split operations** with explicit boundary/editor preview and undo/redo (`WORD_SEGMENTATION.md`). Enforce **no spaces within a single lexical token's Pinyin**, e.g. `piàoliang`; retain spaces between distinct tokens in full-line display. Deduped phrase list preserves all ordered occurrences.
- Export legacy `.ts` and project JSON; manual copy to `src/`. Existing renderer untouched.
- Tests: actual song round trips, repeated chorus, static parser security, exported TS compile check, no Remotion regressions.

**Gate:** a real song file can be imported, edited and rendered by the old pipeline after manual copy.

### M2 — Local audio / lyric timing editor

- Read and edit per-occurrence `startMs` and `endMs` in the same canonical model.
- Load local audio/footage, waveform timeline, play/pause/seek, drag/trim, precise text fields, start/end capture, nudge, warnings and undo.
- Export exact milliseconds to old `TIMELINE`; no forced frame quantization.
- Keep cue timing independent of phrase review; explicit errors for unassigned raw-lyric times.

**Gate:** re-time a repeated chorus occurrence and round trip without changing the others; no more editing numeric values in `.ts` for routine timing.

### M3 — Existing Python AI/NLP backend in the React UI

- Extract reusable logic from locally implemented Streamlit work (preserve tests), expose minimal API only where needed.
- Existing normalizer, Jieba, OpenCC, CC-CEDICT, prompt context and LLM model adapters should be reused, not reimplemented in TS.
- Draft generation per unique phrase, revision controls, dictionary evidence, provenance and safe replacement/undo. Keep API keys server-only, and no silent paid requests.

**Gate:** AI draft can be generated, manually corrected, saved, and exported without affecting occurrence timings.

### M4 — Remotion consolidation without visual changes

- Inventory/baseline from M0 drives each extraction.
- Pull out pure lyric and timing helpers, typography, common video overlays, intros/outros and reusable thumbnail typography.
- Implement distinct background strategies: **music-video footage** and **image + visualizer**, sharing lyric rendering but keeping their specific behavior separate.
- Add typed presets (`legacy-video`, `legacy-image-visualizer`, verified thumbnail variants) and grouped configurable props for media, color, visualizer intensity, background fit/blur and lyric visibility.
- Thin compatibility wrappers preserve all known composition IDs, FPS, dimensions, durations, 16:9/9:16, short/pinyin-only variants, thumbnails, output appearance.

**Gate:** capture and compare render frames for all representative variants and thumbnails; no audio double-play and no unintended frame shifts.

### M5 — Video settings → real Remotion preview and rendering

- Wire workbench video config through a typed adapter into shared Remotion composition.
- Select video/image mode, configurable visualizer primary/secondary colors/opacity/intensity, typography presets, aspect/lyric variant and relevant overlays.
- Actual Remotion Player preview with the *same renderer/presets* as exported video, synchronized to selected timestamp. Keep manual export fully supported.
- Optional explicit local render/export API; first check whether existing CLI render is sufficient. No file-system writes without user's explicit action.

**Gate:** preset defaults reproduce legacy video. A visualizer color change in UI appears in final render, and the selected lyric has correct timing.

### M6 — Optional capabilities (not MVP)

- Assisted auto-sync/forced alignment and word-level karaoke timing.
- Project library, file watching, local asset persistence, direct Remotion render queue.
- Additional custom background modes and advanced thumbnail designer.
- Publishing and deployment tooling only if useful.

## Operating principles

Milestones are *ordered integration checkpoints*, not one broad code change. Avoid large speculative dependencies. Codex should report which gates passed and stop before crossing significant architecture decisions or destructive migrations. Reuse working code first; define shared logic only after auditing behavior. Maintain current CLI workflows throughout.

## Pointers

`CODEX_TASK.md` — operational instructions.
`ARCHITECTURE.md` — canonical data, import/export, Python/Remotion boundaries.
`TIMING_EDITOR.md` — detailed UX/clock contract.
`REMOTION_REFACTOR.md` — extraction strategy and prop classification.
`UI_SPEC.md` — screens and design tokens.
`TEST_PLAN.md` — acceptance and regression checklist.
