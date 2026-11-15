# React Lyric Workbench — documentation map

**Current work priorities:** [../ROADMAP.md](../ROADMAP.md). This directory contains domain contracts, UI guidance and proposed experiments.

## What the workbench does

Local-first React UI for importing raw lyrics or compatible legacy song `.ts` files; reviewing shared Chinese/EN/PL lyric phrases and word glosses; assigning independently editable timing to repeated occurrences; and exporting legacy `.ts` plus workbench project JSON. Python remains the source of existing NLP/dictionary/AI logic; Remotion remains the video renderer. Actual React–Python AI generation and real renderer preview are planned, not implemented.

## Current reference documents

- [ARCHITECTURE.md](ARCHITECTURE.md) — contracts, boundaries, import/export and stable IDs.
- [UI_SPEC.md](UI_SPEC.md) — screen organization and visual language; mockups are references, not current-state evidence.
- [WORD_SEGMENTATION.md](WORD_SEGMENTATION.md) — lexical split/merge, Pinyin and validation behavior.
- [TIMING_EDITOR.md](TIMING_EDITOR.md) — timing workflow and constraints.
- [features/lyrics-grouping/SPEC.md](features/lyrics-grouping/SPEC.md) — grouping behavior and UI references.
- [features/lyrics-import-enhancements/SPEC.md](features/lyrics-import-enhancements/SPEC.md) — proposed replacement protection and live structure preview.
- [ASSISTED_TIMING.md](ASSISTED_TIMING.md) — proposal for an experiment; not implemented.
- [REMOTION_REFACTOR.md](REMOTION_REFACTOR.md) — requirements for checkpoint D.
- [TEST_PLAN.md](TEST_PLAN.md) — verification gates, including items still open from early checkpoints.
- [THEME.css](THEME.css), [lyric-workbench-design.html](lyric-workbench-design.html) and sibling images — retained visual/design references; inspect the real app for current UI.

## How to work with these documents

For commands, editing, media relinking and troubleshooting, use [web/README.md](../../web/README.md). [The parent index](../README.md#authority) explains document authority.
