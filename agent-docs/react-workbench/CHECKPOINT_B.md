# Checkpoint B — local lyric timing and grouping

Status: implementation complete; the user accepted their manual testing as sufficient on 2026-11-14 and requested final verification and commit preparation. Base commit: `42913bc` (checkpoint A). The Python helper commit is committed; React changes are prepared for the next commit. This report describes the final behavior, replacing the earlier incremental review notes.

## Delivered behavior

- Local audio/video soundtrack playback uses one native media clock. Local Web Audio decoding supplies at most 1,600 waveform peaks; large files, long tracks and decode failures retain playback/ruler editing. Media is never uploaded or embedded in project data; reopening requires relinking the local file.
- Every lyric appearance has independent integer millisecond timing. Exact fields and S/E capture reject malformed, negative, inverted and past-media-duration intervals. Overlapping drafts are allowed and warned, including on pointer drop; ordinary gaps need no warning. Keyboard nudges allow temporary overlaps consistently with pointer dragging. Imported timings are not silently repaired or quantized.
- Timeline selection seeks to the lyric start both paused and playing, matching sidebar selection. Selection reveals blocks in both axes and scrolls the sidebar. Background hand-drag pans while paused; playback follows at 15/16 → 1/16. Programmatic scrolling is smooth, with reduced-motion support. Zoom defaults to 8×, supports 32× and increases ruler density; neighbor-edge snapping defaults on. No frame-rate or beat-grid snapping remains.
- Each drag is one undo entry. Reset restores the selected appearance's original timing; Undo reverses it. Audio metadata stays associated with the currently selected file through edit history. JSON stores lightweight audio metadata, original timing baselines and groups, while legacy TypeScript retains the existing renderer contract.
- New lyrics are inserted after the selected lyric. Their words determine the shared lyric text as rows are edited/reordered. Where an available gap permits it, a new lyric starts at its predecessor's end for up to two seconds; otherwise it remains unassigned. Timing → Repeat inserts a shared-translation appearance after the source with its original timing, allowing an overlap that can be moved manually. Removing the last appearance uses an in-app confirmation and removes its shared phrase; Undo restores both.
- Raw lyrics reuse local Python OpenCC, Jieba and CC-CEDICT for simplified editable word drafts, title/credit/heading handling and repetition preservation. EN/PL sentence translations remain manual. The full supplied 做你的猫 fixture has 22 unique phrases and 73 appearances. Numbered-Pinyin tone placement is corrected without editing published song sources.
- Dictionary lookup works on demand for raw imports and legacy songs through local Python, with a bounded frontend memory cache. Definitions are never saved in project JSON/TS; old reference fields are discarded on load. The sidebar attributes CC-CEDICT/MDBG, formats Simplified examples and shows Pinyin in hover/focus bubbles. Wiktionary opens in an in-app iframe dialog. The LLM-inferred contextual sense remains future work.
- The lyric editor has one empty-row Add word action, split/merge, review validation and EN/PL translations. Personal notes, redundant phrase/text previews and row/character counters are removed. Legacy empty-Hanzi grammar tokens remain supported. Duplicate text with conflicting translations/breakdowns blocks renderer export while JSON drafts remain saveable.

## Grouping and final review decisions

See [the feature spec](features/lyrics-grouping/SPEC.md) and [implementation details](features/lyrics-grouping/IMPLEMENTATION.md).

- Group starts at the selected ungrouped lyric, or asks for a first lyric if the selection already belongs to a group. First/Last labels and an inclusive hover preview identify boundaries. The endpoint click freezes the range; Adjust range reopens it. Existing groups block crossing. Cancel/Escape leaves the original selection unchanged.
- The name starts empty. Create requires a name and at least two consecutive ungrouped appearances. Grouping opens with smooth reveal of the starting lyric. Boundary labels reserve equal space so hovering does not resize rows. The compact form has a stable status area and equal-height Cancel / Adjust range / Create actions, with Create on the right.
- Groups have stable IDs and fixed membership; no nesting or shared membership. Their arrow/name toggles collapse. Group emphasis follows a selected member rather than independent header selection. A compact custom tooltip combines warnings under one “Warning:” prefix. The sidebar menu offers Rename, Duplicate, Ungroup and confirmed Delete group. Sidebar dragging is removed.
- Group handles shift all timed members by one snapped offset, preserving durations/gaps and clamping at zero. Individual moves affect only their appearance. Overlaps/interleaving are non-blocking warnings. Sidebar top-level units and group children sort chronologically with stable ties; untimed units remain at the bottom.
- Duplicate uses an isolated stationary ghost moved by its own handle, with name and explicit Create copy / Cancel. Other edits are inactive and playback pauses; passive panning remains available. Confirmation creates fresh group/appearance IDs atomically; cancel changes no saved data/history. Untimed members remain untimed.
- Timeline group rectangles and standalone blocks compact into shared vertical space after drops. Rows stay frozen during drag previews; obsolete empty rows disappear on commit. All rows reserve rail space so boxes align along their bottoms. Group accents, a bright selected-block outline and a count/offset drag label distinguish membership and selection. View layout is never serialized.

## Verification

Final verification completed on 2026-11-14:

| Check                                                                   | Result                                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run workbench:test`                                                | 80 passed, no skips; local endpoint test needs loopback permission                      |
| `python-src/venv/bin/python -m pytest -q`                               | 84 passed with warnings as errors; `pip check` passed                                   |
| `npm run workbench:check`                                               | Frontend and tooling strict TypeScript passed                                           |
| `npx eslint web scripts`                                                | Passed                                                                                  |
| Production esbuild bundle (`write: false`, production define)           | Passed in memory; dev assets untouched                                                  |
| `npm run workbench:test:browser`                                        | M1 editor and M2 real audio/timing/browser acceptance passed                            |
| `npm run workbench:test:cat-song-workflow`                              | Full supplied song workflow passed                                                      |
| `npm run workbench:test:lyrics-grouping`                                | Group creation, blank names, ranges, movement, duplication and history passed           |
| `npm run workbench:test:reload`                                         | Isolated dev server reloaded edited React and retained browser recovery                 |
| `npm run workbench:test:export -- --song out/workbench/timed-export.ts` | Actual downloaded timing export rendered through unchanged LyricVideo2; frame inspected |
| `npm run format:changed:check`, `git diff --check`                      | Passed after documentation formatting                                                   |

Export evidence: `out/workbench/export-check-AMgbL6/edited.png` and `result.json`. The inspected frame displays 你好, its Pinyin/gloss and Hello / Cześć translations. The render emitted existing macOS/font-subset advisories but completed successfully. This is a compatibility still, not a full-video or renderer-baseline comparison.

Browser checks use temporary loopback servers and isolated projects with the installed browser. Production bundling is performed in memory to leave the user's development assets/server alone. Screenshots/downloads are disposable under ignored `out/workbench/` and `output/playwright/`; `npm run workbench:clean` covers test-owned outputs. No dependency/browser installation or paid AI call is required.

The user has accepted their manual testing; automated results do not claim full-video equivalence. Renderer refactoring, reference footage through the owner's working Chrome/client-side path, and real Remotion Player/settings remain later checkpoints. Earlier native server-side footage capture limitations are separate from that working renderer.

## Commit preparation

The implementation is split into two commits:

1. `feat(workbench): add local lyric draft and dictionary helpers` — Python draft import/lookup, Pinyin correction and matching Python tests/fixture. This reuses established local NLP; no Streamlit UI change or AI integration.
2. `feat(workbench): add lyric timing and passage grouping` — React timing, grouping, editor/dictionary refinements, local API routes, browser/domain tests, artifact cleanup and matching workflow/spec/roadmap documentation. Include this report to preserve the user's review decisions.

Keep original songs, media and Remotion components/configuration untouched. Run `npm run format:staged:check` / the installed commit hook after staging. React changes and their regression tests are staged for the user’s review.

## Next checkpoint

Checkpoint C adds explicit unique-phrase AI draft generation/revision through the existing Python backend, server-only credentials, protected manual segmentation/edits, contiguous per-word Pinyin and visible inferred meaning/provenance. Assisted lyric alignment (including tone-free Pinyin matching) and reliable beat analysis remain experiments under [ASSISTED_TIMING.md](ASSISTED_TIMING.md).

Post-closeout duplicate-preview fix: entering duplication now reveals the ghost vertically and horizontally through native scrolling of all ancestors. The tall grouping browser fixture covers this regression. Confirmation retains the documented compact committed layout; preview row positions remain temporary. TypeScript, lint and grouping browser checks passed for this follow-up.

Packaging follow-up: pin Setuptools 84.2.1 in the shared Python requirements and update the virtualenv. Jieba uses its existing filesystem resource fallback because modern Setuptools omits `pkg_resources`; no warning filter or dependency monkey-patch is added. All 75 Python tests pass with warnings as errors, resource loading works outside the repository working directory, and `pip check` passes.

First-commit review fixes: Traditional credit labels are filtered before draft import, and dictionary reference readings convert numbered pronunciation syllables while retaining literal punctuation/numerals. Nine regression cases cover the reported failures. All 84 Python tests pass with warnings as errors. The eight Python/helper/test/fixture/requirements/README files are committed; React and closeout documentation are staged for review.

Final review regressions: keyboard nudges preserve direction and duration for coincident repeats; deleting a selected group selects a surviving phrase/token in the lyric editor. All 80 automated tests, frontend/tooling TypeScript checks and the grouping browser workflow passed after these fixes. M2 acceptance covers these automated interactions and the user’s accepted manual testing; actual touch interaction and perceptual synchronization quality were not independently verified.
