# React Lyric Workbench — documentation map

**Current work priorities:** [../ROADMAP.md](../ROADMAP.md). This directory contains domain contracts, UI guidance and proposed experiments.

## What the workbench does

Local-first React UI for importing raw lyrics or compatible legacy song `.ts` files; reviewing shared Chinese/EN/PL lyric phrases and word glosses; assigning independently editable timing to repeated occurrences; and exporting legacy `.ts` plus workbench project JSON. Python remains the source of existing NLP/dictionary/AI logic; Remotion remains the video renderer. Provider-backed translation drafts and revisions are implemented. Automatic timing and occurrence review are complete. Live Remotion preview remains planned.

## Current reference documents

- [ARCHITECTURE.md](ARCHITECTURE.md) — contracts, boundaries, import/export and stable IDs.
- [UI_SPEC.md](UI_SPEC.md) — screen organization and visual language; mockups are references, not current-state evidence.
- [WORD_SEGMENTATION.md](WORD_SEGMENTATION.md) — lexical split/merge, Pinyin and validation behavior.
- [TIMING_EDITOR.md](TIMING_EDITOR.md) — timing workflow and constraints.
- [features/lyrics-grouping/SPEC.md](features/lyrics-grouping/SPEC.md) — grouping behavior and UI references.
- [features/lyrics-import-enhancements/SPEC.md](features/lyrics-import-enhancements/SPEC.md) — proposed replacement protection and live structure preview.
- [ASSISTED_TIMING.md](ASSISTED_TIMING.md) — evaluation evidence and safeguards; not the authority for the proposed review UI.
- [Automatic Timing & Review](features/automatic-timing-review/SPEC.md) — workflow, integration constraints, approved owner decisions, and implementation verification.
- [Workflow navigation](features/workflow-navigation/SPEC.md) — separate unprioritized app-shell proposal and relocated header reference.
- [REMOTION_REFACTOR.md](REMOTION_REFACTOR.md) — requirements for checkpoint D.
- [TEST_PLAN.md](TEST_PLAN.md) — verification gates, including items still open from early checkpoints.
- [THEME.css](assets/THEME.css), [lyric-workbench-design.html](assets/lyric-workbench-design.html) and existing reference images — retained visual/design references; inspect the real app for current UI.

## How to work with these documents

For commands, editing, media relinking and troubleshooting, use [web/README.md](../../web/README.md). [The parent index](../README.md#authority) explains document authority.
