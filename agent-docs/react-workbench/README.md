# Chinese Lyric Video — Integrated Workbench Plan (v2.1)

**Status:** Architecture + implementation brief + interactive design reference; NOT implemented production React code.
**Date:** 2026-11-12
**Target:** `hckr/chinese-lyric-video`, with *local uncommitted Streamlit work* that must be inventoried before modifying anything.

## What changed in v2.1

The translation editor must support **splitting a word into two word tokens and merging adjacent tokens into one**. The canonical `words[].pinyin` value is **contiguous within a word** (`漂亮` → `piàoliang`, not `piào liang`); rendering multiple distinct words still inserts spaces between their Pinyin values. These requirements belong in the **first React MVP**, with matching corrections in the existing Python AI pipeline during backend integration. See `WORD_SEGMENTATION.md` for behavior, guards, user-confirmed gloss/Pinyin edits, and regression tests.

The HTML reference now includes working **Split selected word** and **Merge with next** dialogs and a Pinyin-spacing warning. `review-dark-v2.1.png`, `split-word-dialog.png`, and `merge-words-dialog.png` show the new controls. The existing timing/video screenshots remain valid and unchanged. The prototype is still a UI reference, not production TS parsing or AI logic.

## Intended product

A local-first React workbench for:

1. **Import** — raw Chinese lyrics or existing Remotion song `.ts` modules.
2. **Translation** — edit unique phrases once, including EN/PL, **merge/split word tokens**, contiguous per-word Pinyin (`piàoliang`, not `piào liang`), glosses and notes; later reuse the existing Python AI/NLP backend.
3. **Timing** — synchronize each *occurrence* against a local audio track, with waveform, scrub/play, drag/trim, precise time inputs and keyboard nudging.
4. **Video settings** — choose either music-video footage or an image + audio visualizer, configure sensible visual parameters, choose layout/presets, eventually drive the real Remotion preview.
5. **Export** — first download a backward-compatible song `.ts` for manual placement in `src/`; keep a separate workbench project JSON for timing, media and visual settings.

The workbench **is not a video-rendering replacement**. Remotion remains the render engine. Python keeps existing AI and dictionary logic. React is the UI and canonical editing surface.

## Start here

- **`CODEX_TASK.md`** — authoritative execution brief for Codex, staged milestones, safe handling of uncommitted work, acceptance criteria.
- **`ROADMAP.proposed.md`** — roadmap to *merge* with the real local `agent-docs/ROADMAP.md` (do not blindly overwrite).
- **`ARCHITECTURE.md`** — data model, import/export compatibility and boundaries between React, Python, Remotion.
- **`WORD_SEGMENTATION.md`** — required word merge/split controls, Pinyin orthography, validation and export/AI invariants.
- **`TIMING_EDITOR.md`** — precise timing UI, interactions, timing invariants, and audio synchronization.
- **`REMOTION_REFACTOR.md`** — audit-first extraction plan, background modes, thumbnail reuse, prop/preset policy.
- **`UI_SPEC.md`** — screen structure and dark/blue design tokens.
- **`TEST_PLAN.md`** — regression gates, round-trip checks and visual comparisons.
- **`DECISIONS.md`** — settled choices vs details Codex must discover during the local audit.
- **`CODEX_PROMPT.md`** — short, copyable kickoff prompt.
- **`lyric-workbench-design.html`** — self-contained clickable *design prototype*; review/import/export screens plus newly added timing and video-settings mockups. Not production logic.

## Handoff to Codex

Unzip into the **repository root**, so the files land at `agent-docs/react-workbench/`. Then, from the local checkout, instruct Codex:

> Read `agent-docs/react-workbench/CODEX_TASK.md` and all referenced documents. First inspect and protect all uncommitted Streamlit/Python work, inventory the current Remotion compositions and assets, and reconcile `ROADMAP.proposed.md` with the local roadmap. Implement the plan in gated milestones; keep existing video outputs, composition IDs and file compatibility. Start with the file-based React editor, then timing, Python AI integration, Remotion consolidation, and settings-to-renderer integration. Report each completed milestone, changes, tests and remaining work. Avoid unnecessary dependencies.

**Do not ask Codex to implement all milestones as one giant unreviewed diff.** Use checkpoints and accept each stage once it passes the relevant tests.

## Important qualifications

- The original roadmap and song example were previously consulted. In preparing this iteration, the GitHub repository's current files were **not accessible for a fresh full audit**, and your local uncommitted changes cannot be inspected remotely. All suggested names/layouts are *proposals*, not claims about the checked-out tree. Codex must inspect reality and adjust.
- The timing demo contains **illustrative waveform/timestamps** and local UI interaction mockups. Real media-backed synchronization, safe TS parsing, AI requests, waveform generation and Remotion preview are *implementation requirements*, not delivered by the HTML reference.
- Manual `.ts` download/copy remains the first operational workflow. Do not move visual config fields into existing song modules until compatibility and the actual Remotion consumer types are verified.
