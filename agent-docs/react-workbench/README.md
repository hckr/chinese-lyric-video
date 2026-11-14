# React Lyric Workbench — documentation map

**Current work priorities:** [../ROADMAP.md](../ROADMAP.md). This directory contains domain contracts, UI guidance, experiments and historical migration reports.

## What the workbench does

Local-first React UI for importing raw lyrics or compatible legacy song `.ts` files; reviewing shared Chinese/EN/PL lyric phrases and word glosses; assigning independently editable timing to repeated occurrences; and exporting legacy `.ts` plus workbench project JSON. Python remains the source of existing NLP/dictionary/AI logic; Remotion remains the video renderer. Actual React–Python AI generation and real renderer preview are planned, not established by the supplied reports.

**Important invariant:** per-word Pinyin is contiguous (`漂亮` → `piàoliang`), with spaces _between_ lexical words in full-line display. Imported authored readings must not be rewritten silently. See [WORD_SEGMENTATION.md](WORD_SEGMENTATION.md).

## Current reference documents

- [ARCHITECTURE.md](ARCHITECTURE.md) — contracts, boundaries, import/export and stable IDs.
- [UI_SPEC.md](UI_SPEC.md) — screen organization and visual language; mockups are references, not current-state evidence.
- [WORD_SEGMENTATION.md](WORD_SEGMENTATION.md) — lexical split/merge, Pinyin and validation behavior.
- [TIMING_EDITOR.md](TIMING_EDITOR.md) — timing workflow and constraints.
- [features/lyrics-grouping/SPEC.md](features/lyrics-grouping/SPEC.md) — grouping behavior and UI references.
- [ASSISTED_TIMING.md](ASSISTED_TIMING.md) — proposal for an experiment; not implemented.
- [REMOTION_REFACTOR.md](REMOTION_REFACTOR.md) — requirements for checkpoint D.
- [TEST_PLAN.md](TEST_PLAN.md) — verification gates, including items still open from early checkpoints.
- [THEME.css](THEME.css), [lyric-workbench-design.html](lyric-workbench-design.html) and sibling images — retained visual/design references; inspect the real app for current UI.

## Transitional documents — do not follow as a fresh kickoff

`ROADMAP.proposed.md`, `CODEX_TASK.md` and `CODEX_PROMPT.md` describe the _original migration kickoff_, including already completed checkpoints. `CHECKPOINT_A.md`, `CHECKPOINT_B.md` and `LOCAL_AUDIT.md` record historical observations and evidence; they are not guaranteed to reflect current Git status. `DECISIONS.md` includes older investigation prompts. These files remain intact until a separate, reviewed consolidation preserves all relevant constraints. See [the parent documentation index](../README.md).

## How to work with these documents

Follow the small root `AGENTS.md` rules and [active roadmap](../ROADMAP.md). For a substantial implementation task, propose a full plan first and track steps in Codex's native task tracker. Only read domain documents relevant to that task. Update verified behavior and remaining work in place; do not turn every checkpoint into a permanent progress diary.
