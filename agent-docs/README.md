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

## Authority

[ROADMAP.md](ROADMAP.md) owns priorities and completion status. Architecture and domain references own shared contracts; feature specifications own feature requirements. [TEST_PLAN.md](react-workbench/TEST_PLAN.md) owns cross-feature acceptance checks and known issues. READMEs provide navigation and operating instructions. Link to the authoritative definition instead of restating it.

## Working rules

- Express verifiable contracts in schemas, domain functions and automated tests. Documentation should explain product decisions and boundaries, and link to executable definitions rather than repeat their assertions.
- A proposed feature can have one reference document before implementation and keep that same document afterward, updated to reflect current behavior. Tiny changes usually belong in an existing reference, not a new file.
- Assets and mockups are reference material, not proof of current implementation. Preserve them unless their removal is separately approved.
- New ideas and bugs go into the roadmap's **Triage** section automatically; only the owner sets implementation priority.
- Documentation updates belong with the implementation they describe, but no commit happens before owner review and explicit approval.
