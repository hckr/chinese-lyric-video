# Agent documentation — start here

This folder is primarily working context for agents. Keep it discoverable without making every agent read everything. **Use [ROADMAP.md](ROADMAP.md) for current status and priorities; use the actual code for implementation truth.**

## Current references

| Need                                                              | Read                                                                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| What should be done next / what's still open                      | [ROADMAP.md](ROADMAP.md)                                                                                                   |
| Architecture, data contracts and Python/React/Remotion boundaries | [react-workbench/ARCHITECTURE.md](react-workbench/ARCHITECTURE.md)                                                         |
| Workbench screens and UI decisions                                | [react-workbench/UI_SPEC.md](react-workbench/UI_SPEC.md), [react-workbench/README.md](react-workbench/README.md)           |
| Timing behavior and interaction constraints                       | [react-workbench/TIMING_EDITOR.md](react-workbench/TIMING_EDITOR.md)                                                       |
| Word-level Pinyin and segmentation                                | [react-workbench/WORD_SEGMENTATION.md](react-workbench/WORD_SEGMENTATION.md)                                               |
| Grouping behavior and design references                           | [react-workbench/features/lyrics-grouping/SPEC.md](react-workbench/features/lyrics-grouping/SPEC.md)                       |
| Proposed import safeguards and live grouping preview              | [react-workbench/features/lyrics-import-enhancements/SPEC.md](react-workbench/features/lyrics-import-enhancements/SPEC.md) |
| Assisted timing experiment (unimplemented)                        | [react-workbench/ASSISTED_TIMING.md](react-workbench/ASSISTED_TIMING.md)                                                   |
| Remotion refactor requirements                                    | [react-workbench/REMOTION_REFACTOR.md](react-workbench/REMOTION_REFACTOR.md)                                               |
| Acceptance gates and remaining unchecked items                    | [react-workbench/TEST_PLAN.md](react-workbench/TEST_PLAN.md)                                                               |

## Historic or transitional material

The following documents are retained **temporarily** to prevent lost requirements while they are reconciled. They are **not authoritative** for current priority or instructions:

- `react-workbench/ROADMAP.proposed.md`, `react-workbench/CODEX_TASK.md`, `react-workbench/CODEX_PROMPT.md`: initial React migration proposal and kickoff instructions; superseded as a work queue by `ROADMAP.md`.
- `react-workbench/CHECKPOINT_A.md`, `react-workbench/CHECKPOINT_B.md`: reports of implementation and verification _at those times_, not live Git-status reports.
- `react-workbench/LOCAL_AUDIT.md`: historical local repository audit; re-check actual code before relying on details.
- `react-workbench/DECISIONS.md`: original settled decisions and investigation questions; some may now be answered.
- `react-workbench/features/lyrics-grouping/IMPLEMENTATION.md`: historical implementation/verification details, to reconcile into the living feature reference before eventual removal.

**Cleanup policy:** move useful unresolved constraints/decisions into a relevant living reference _before_ proposing deletion. Don't copy whole logs into other documents. Git retains the originals after reviewed removal.

## Working rules

- A proposed feature can have one reference document before implementation and keep that same document afterward, updated to reflect current behavior. Tiny changes usually belong in an existing reference, not a new file.
- Assets and mockups are reference material, not proof of current implementation. Preserve them unless their removal is separately approved.
- New ideas and bugs go into the roadmap's **Triage** section automatically; only the owner sets implementation priority.
- Documentation updates belong with the implementation they describe, but no commit happens before owner review and explicit approval.
