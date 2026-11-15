# Active roadmap and work backlog

**As of:** 2026-11-15 reconciliation. Implementation summaries were checked against source; outstanding checks and known issues are in [TEST_PLAN.md](react-workbench/TEST_PLAN.md). Recheck code and run relevant checks before closing implementation work.

This is the **single authoritative list** of priorities and unfinished work. Details live in linked references, not repeated here. Checkpoints are broad migration objectives; smaller features can be implemented before, within or between checkpoints. **Only the owner sets priorities.**

## Near-term priorities — proposed order, not a locked schedule

| Work                                               | State                                                                                             | Intent / dependency                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lyrics import enhancements**                     | [Proposed](react-workbench/features/lyrics-import-enhancements/SPEC.md) — before C where possible | Project replacement protection (**A**) and immediate deterministic grouping preview (**B1**) are candidates before C. AI-assisted grouping (**B2**) depends on AI integration. YouTube import (**D**) is deferred. The group model exists; preview/source mapping and replacement protection remain unfinished.                                                                             |
| **Assisted timing / known-lyrics alignment spike** | Experiment — desired before C/D                                                                   | Evaluate whether suggestions reduce manual timing work, with tone-free Pinyin as a _hypothesis_, not a guarantee. Explore independent reuse of existing Python first; identify any unavoidable C-bridge prerequisite. Follow [experiment and evaluation gate](react-workbench/ASSISTED_TIMING.md). Do not silently expand it into an unapproved full implementation.                        |
| **Checkpoint C — Python AI/NLP integration**       | Planned main checkpoint                                                                           | Reuse existing Python NLP, dictionary and LLM logic; opt-in per-unique-phrase generation, revision and provenance; protect human edits and timing. Follow the segmentation contract and contextual-sense requirements. See [AI boundary and requirements](react-workbench/ARCHITECTURE.md#proposed-ai-interface-and-backend-reuse) and [tests](react-workbench/TEST_PLAN.md#m3--python-ai). |
| **Checkpoint D — Remotion consolidation**          | Planned after C                                                                                   | Audit and reference-render every composition family; refactor incrementally without visual/audio regressions, retaining entrypoints/IDs. Follow [Remotion requirements](react-workbench/REMOTION_REFACTOR.md) and [tests](react-workbench/TEST_PLAN.md#m4--remotion-consolidation).                                                                                                         |
| **Checkpoint E — preview and render integration**  | Planned after D                                                                                   | Connect UI settings to actual Remotion preview/render using shared configuration; preserve manual `.ts`/project JSON export. See [preview/render integration](react-workbench/REMOTION_REFACTOR.md#how-the-react-ui-consumes-this) and [tests](react-workbench/TEST_PLAN.md#m5--ui-to-remotion).                                                                                            |
| **Remove Streamlit UI and obsolete dependencies**  | Pending migration — **explicit task**                                                             | Only after the React workflow provides the needed functionality and existing Python AI/NLP logic is retained and verified. Determine the safe point after C/E; do not remove useful backend code or uncommitted work.                                                                                                                                                                       |

**Priority nuance:** the owner would like import enhancements and the assisted-timing experiment _before_ major C/D work. Some subparts may depend on the Python API bridge; investigate and split accordingly rather than claiming a dependency is already resolved.

## Unresolved carry-forwards (not cleared by accepting checkpoint B)

- **M0 / renderer baseline:** Capture reliable representative footage frames through the owner's working Chrome/client-side path, plus image+visualizer and all thumbnail families. Required before claiming D visual equivalence. Historical server-side capture failure is a method issue, not proof the working renderer is broken. [Checks and issues](react-workbench/TEST_PLAN.md#known-issues) · [Gate](react-workbench/TEST_PLAN.md#m0--baseline--preservation).
- **M1 / Python-generated Pinyin:** Python generation/validation still needs to enforce the [Pinyin contract](react-workbench/WORD_SEGMENTATION.md) during C. [Gate](react-workbench/TEST_PLAN.md#m1--editorimportexport).
- **M1 / legacy renderer coverage:** Existing TS consumer checks and a sample export render passed, but footage-route/full compatibility verification was still partial in checkpoint A. Reconcile with M0/D, not a blanket claim that legacy exports fail. [Checks and issues](react-workbench/TEST_PLAN.md#known-issues).
- **Dictionary contextual sense:** Show model-inferred meaning separately from dictionary senses, with provenance/manual correction; do not claim a matched dictionary sense unless one was actually identified. Integrate with C. [Contract](react-workbench/ARCHITECTURE.md#implemented-local-python-integration).
- **Review visual fidelity:** React UI was accepted functionally, but not certified as matching the supplied mockups pixel-for-pixel. Treat any follow-up redesign as a scoped task, not an implied blocker for C. [Checks and issues](react-workbench/TEST_PLAN.md#known-issues).
- **Root tooling issues:** Checkpoint A reports preexisting root TypeScript/lint issues in Remotion `src/`, separate from passing workbench checks. Confirm current status and scope repairs deliberately. [Checks and issues](react-workbench/TEST_PLAN.md#known-issues).
- **Timing-device validation:** Checkpoint B acceptance did not independently establish touch interaction or perceptual lyric/audio synchronization quality. Consider targeted checks when relevant, not an automatic reopening of B. [Timing checks](react-workbench/TEST_PLAN.md#m2--timing).

## Implemented work

- **Checkpoint A / React file workflow:** Import/review/export; semantic song TS round trips, project JSON, segmentation merge/split and review state. Some shared M0/M1 gates remain open above.
- **Checkpoint B / manual timing:** Local audio clock/waveform, occurrence-level ms editing and group behavior; user accepted manual testing on 2026-11-14. [Timing checks](react-workbench/TEST_PLAN.md#m2--timing).
- **Lyrics grouping:** Fixed-membership groups, timeline movement, explicit duplicate-and-confirm flow. [Living spec](react-workbench/features/lyrics-grouping/SPEC.md).
- **32× timeline zoom and adaptive ruler:** **Implemented**, not pending (confirmed by checkpoint B report and owner).
- **Local dictionary lookup and Python lyric drafts:** Added during B; this does **not** mean checkpoint C's AI-generation workflow is complete.
- **Application versioning:** Baseline `0.1.0`; [Version-change convention](../web/README.md#application-versioning) is documented for future tasks.

## Triage — captured but not prioritized

These are **not** permission to implement them. Capture newly mentioned actionable ideas here, link detailed specs where they exist, and ask the owner to prioritize only when scheduling work.

- **Direct YouTube-URL song import** — future convenience idea: infer title/artist and find lyrics automatically; defer until the main workflow is established. External data/source reliability and rights need evaluation.
- **Project library, asset persistence/file watching and optional render queue** — later possibilities from the original migration plan.
- **Advanced presets, more background modes and thumbnail design** — later, if warranted by actual use.
- **Unknown-lyrics transcription and word-level karaoke timing** — distinct from the earlier known-lyrics timing experiment.
- **Long-line handling / semantic phrase split suggestions** — the legacy UI warns above 18 characters and suggests midpoint splits (`python-src/app.py`). The older ~11-Hanzi/Jieba semantic-split proposal and possible React carry-forward remain unfinished; decide their usefulness before implementation.
- **Timing viewport proposals** — cursor-anchored zoom, an overview/minimap and a resizable/collapsible inspector remain open; see [timing scope](react-workbench/TIMING_EDITOR.md#executable-references-and-open-proposals).
- **D/E integration questions** — establish which compositions are used in production and verify asset resolution/shared preview configuration across Studio, CLI and the workbench before claiming integration. See [Remotion planning](react-workbench/REMOTION_REFACTOR.md).
- **Timing reset target** — use accepted automated timing as the reset snapshot once alignment exists, rather than reverting new lyrics to unassigned times. Current reset uses initial/imported timings.
- **Optional publishing/deployment automation** — defer unless requested.

## Maintenance conventions

- Keep this list short. Use a row for substantial planned work and concise bullets for unresolved issues/ideas; link to a detailed document only when needed.
- Capture deferred requests automatically, without changing priorities. Do not duplicate an item that already exists.
- Update completion status **only with evidence** and note partially satisfied acceptance gates explicitly.
- Code changes and their relevant living documentation should be reviewed together; no commits without owner approval.
- Retain preservation constraints: protect user changes, published songs/media, original Remotion composition identities and manually reviewed text/timing. Check [architecture](react-workbench/ARCHITECTURE.md) and [acceptance gates](react-workbench/TEST_PLAN.md) when working in those areas.
