# Acceptance tests and regression plan

This reference lists cross-feature acceptance checks and known issues. Feature requirements belong to [segmentation](WORD_SEGMENTATION.md), [timing](TIMING_EDITOR.md), [grouping](features/lyrics-grouping/SPEC.md), [import enhancements](features/lyrics-import-enhancements/SPEC.md), [assisted timing](ASSISTED_TIMING.md) and [Remotion](REMOTION_REFACTOR.md). Checked items below record historical passes, not a fresh run on the current checkout. When you work on a feature, run its remaining checks before calling it complete.

## M0 — baseline / preservation

- [x] Existing user work preserved; inspect current Git changes before implementation.
- [x] Current song files and all registered Remotion composition IDs, FPS, durations, dimensions, aspect ratios, audio origins, backgrounds, thumbnails inventoried.
- [x] Initial stills captured for image+visualizer and all three thumbnail families.
- [ ] Representative intro/active/repeat/long-line/outro references completed for all video families through a working capture path and retained before D extraction.
- [x] Existing CLI Remotion render and Python tests documented; no local user work discarded.

## M1 — editor/import/export

- [x] Import at least two real existing song TS modules; support consts/references/spreads/`as const`/Hanzi keys/known getter; unsupported expressions fail visibly without mutating editor state.
- [x] Export/re-import preserving normalized metadata, occurrence IDs/order/keys/times, translations, Pinyin, multiline glosses, empty-Hanzi grammar tokens.
- [x] UI can **merge adjacent lexical tokens** and **split a lexical token** at a chosen Hanzi boundary, with editable Pinyin/gloss, note preservation, review invalidation and undo/redo. Verify export/reimport; see `WORD_SEGMENTATION.md`.
- [x] Frontend validation, explicit correction and TS round trips exercise the [Pinyin contract](WORD_SEGMENTATION.md).
- [ ] Python generation/postprocessing/response validation enforces that same contract for new output.
- [x] Split/merge changes do not alter phrase translation, repeated occurrences, timestamps or unrelated word tokens.
- [x] Repeat chorus appears N times in timeline but one unique phrase is edited; modifying the phrase updates every displayed instance.
- [x] Raw lyrics with repeated line and section heading preserve occurrence order, report unassigned timings.
- [x] Both exported songs typechecked against all four actual video consumer types.
- [x] Generated/edited TS rendered through unchanged LyricVideo2 by temporary bundle substitution.
- [ ] Representative footage consumer/render compatibility verified through the owner’s working Chrome/client-side path; complete family coverage remains open.

## M2 — timing

- [x] Import `startMs=12345`, `endMs=12789`; exact values survive save/reload/export/re-import (unless user edits them).
- [x] Select the second of three occurrences referring to one phrase; change its start/end; no other occurrence changes.
- [x] Load local audio; playhead uses actual media currentTime, pauses/stops correctly, scrubs and seeks to the requested media position in the browser tests.
- [x] Capture at known audio times exports matching milliseconds within media clock precision.
- [x] Drag/trim and exact numeric edit work; undo/redo works; invalid `end<=start` rejected with intelligible feedback.
- [x] User-reviewed timing policy: normal gaps are allowed without warnings; imported overlaps are flagged without changing data. Draft overlaps are allowed both during previews and after final edits, with warnings; unsynchronized exports warn.
- [x] Timeline not flattened to unique phrases; keep consecutive and repeated occurrences.
- [x] Existing keyboard interactions tested against the [shared interaction rules](UI_SPEC.md#layout--implementation).

- [ ] Independently test touch interaction and perceptual lyric/audio synchronization when device validation is undertaken.

The owner accepted B manual testing on 2026-11-14. This does not close M0/M1 carry-forwards. Grouping regression coverage is linked from its feature specification.

## M2 extension — Automatic Timing & Review (approved requirements; not implemented)

The [feature SPEC §11](features/automatic-timing-review/SPEC.md#11-acceptance-scenarios-and-tests)
owns full scenarios; its §13 records integration constraints, not completed implementation.
Historical engine/UI passes do not check off the new contract. No tests were run
for the 2026-11-18 documentation-only reconciliation.

- [ ] Direct atomic generation in the existing timeline; remove global Preview/Apply and ordinary range/window setup while preserving manual editing and progress/cancel/error handling.
- [ ] Independent per-occurrence review and automatic/last-reviewed reset targets; metadata-aware legacy migration without a version bump, all timing mutations, no-op edits, linked/group moves, repeat/copy and undo/redo.
- [ ] Compact counts/status, contextual reset labels, wrapped auto-advance and secondary bulk review without conflating phrase content review.
- [ ] Individual detected-candidate listen/add, duplicate-click prevention, origins, stable IDs, persistence and distinct handling of unresolved imported rows/weak candidates.
- [ ] Pending detected/weak candidates survive reopen with stable IDs and normalized-audio hashes; matching sources reuse normally, mismatches require explicit reuse/regeneration, unknown hash is not a match. Media replacement never deletes data; no audio/full transcript stored.
- [ ] Regenerated exact matches retain Reviewed, changed authorized replacements need review, and weak/no-result rows preserve current values until explicit per-row use. Latest automatic action retains reviewed reset/undo; copies start unreviewed with no inherited reset references.
- [ ] Bounded Play lyric/one loop control, pre/post-roll and cancellation on context changes; preserve native global clock/playback and untimed manual controls.
- [ ] Accessible gear/summary and validated project preferences, old JSON/defaults, browser recovery and unchanged legacy TS export contract.
- [ ] Preserve-reviewed/default versus explicitly confirmed replace-all regeneration, reviewed snapshot protection, source/revision staleness and missing-result preservation.
- [ ] Full synthetic regressions plus raw-lyrics → audio → generation → review/save/reload owner walkthrough; cached-model smoke and final whole-scope owner acceptance.

Workflow-header navigation has [separate acceptance criteria](features/workflow-navigation/SPEC.md#acceptance-criteria)
and is not required to close this Timing extension.

## M3 — Python AI

- [ ] Existing local Python unit tests retained; no duplicate TS reimplementation of established NLP/dictionary logic.
- [ ] Generate unique-phrase draft, inspect dictionary entries and prompt provenance, accept/revise without losing manual modifications.
- [ ] Failed/canceled/retried AI request preserves editor state; no unexpected automatic paid calls; API keys not present in browser bundle.
- [ ] AI output and proposal acceptance satisfy the [segmentation/Pinyin contract](WORD_SEGMENTATION.md).
- [ ] Repeated phrase reuses the same translation; individual occurrence timing survives translation edits.

**Checkpoint C offline verification.** The [Python fixture](../../python-src/tests/test_react_translation.py)
exercises ordered repeats, vocabulary validation and corrective retries, direct
Chinese-to-Polish prompting, incomplete responses, and selected-word boundaries
with fake transports. The [loopback tests](../../web/tests/translation-api.test.ts)
cover empty jobs, request errors, and worker termination on disconnect.
`node web/tests/browser.ts --translation` covers saved draft recovery, retries
using already received vocabulary, stale protection, timing, undo, and revision.
The [domain tests](../../web/tests/translation.test.ts) exercise an idiom through
preview reading alignment, project JSON, and legacy TypeScript. Live wording,
pronunciation, and contextual gloss quality remain open for owner review.

The workbench type checks and production bundle passed, along with 117 Node
tests, three focused Python translation tests, and the translation browser
acceptance. A broader Python run reached 94 passes, with six failures in the
known local OpenSSL and NumPy/PyArrow paths and eight deselected. The default
browser suite passed the lyrics acceptance and failed its manual timing export
assertions by 1–4 ms on three runs. The same default suite passed on a clean
HEAD checkout using the local browser, virtual environment, and dictionary.
All translation verification used fake provider responses or empty jobs.

The post-import UX follow-up adds checks for empty contextual glosses after raw
import, whole-song draft generation from a mix of empty and presegmented lyrics,
and resuming only unfinished sentences. The browser fixture covers the in-editor
review, saved draft recovery, narrow layout, and explicit replacement of an
existing gloss while keeping its reading. The Python fixture confirms that
fill-missing retries preserve authored word boundaries, readings, and glosses.
The workbench type checks, production build, 117 Node tests, 18 focused Python
tests, default browser suite, and focused import and translation browser checks
passed during the follow-up.

The partial-run follow-up fixture simulates a timeout and rate-limited requests
in a 22-lyric run. It verifies that 12 vocabulary drafts survive, the other
10 lyrics receive vocabulary requests on retry, and 54 outstanding drafts
can be completed. The browser checks cover collapsed diagnostics, inline
review, draft edits, stale drafts, and Undo at desktop and narrow widths.

**Pre-commit review, 2026-11-21.** The workbench build, type checks, lint,
118 Node tests, and the default, synthetic import, and offline translation browser
suites passed. Export tests now select the warning acknowledgment in the export
screen. Keyboard capture is checked separately from exact export/reimport values,
which the fixture enters through the millisecond fields. Python accepted traditional
and simplified erhua readings. After Streamlit retirement and restoration of
OpenSSL access, all 115 Python tests passed in the full working tree and all 96
passed in the isolated retirement checkout. Both runs blocked imports of
Streamlit, PyArrow, and Watchdog. Credential tests used temporary fixtures.

## M4 — Remotion consolidation

- [ ] Every preexisting composition ID, FPS, dimensions, duration behavior, output mode and thumbnail remains available.
- [ ] Comparison frames for footage mode and image+visualizer show baseline-equivalent typography, placement, animation and background treatment.
- [ ] Audio is played **once**, whether video contains audio, separate soundtrack is supplied, or still image mode uses an audio file.
- [ ] Visualizer default colors and motion preserved; configuration overrides affect expected elements only.
- [ ] Short/full/pinyin-only/landscape/portrait cases and each thumbnail family checked.
- [ ] No reliance on unnecessary cross-composition imports or massive prop bags.

## M5 — UI to Remotion

- [ ] Toggling background mode changes the correct renderer path, not merely preview CSS.
- [ ] Changing visualizer primary color in UI appears in actual render, with preset resolution consistent between preview and final.
- [ ] Playhead/cue selection previews the correct phrase/frame; ms/frame conversion tested at actual composition FPS.
- [ ] Missing/moved local files produce a clear media relink instruction instead of fabricated preview.
- [ ] Manual TS/JSON export continues to work even if direct preview/render API is unavailable.

## Review policy

Always report real executed checks separately from planned checks. Compare deterministic frames where possible; document font/render/hardware nondeterminism, and never claim pixel identity without actually measuring it. If an old composition's aesthetic changes intentionally, get explicit approval or document it as a breaking design change rather than quietly treating it as refactoring.

## Future assisted timing experiment

Not part of the current checkpoint B gate. Follow [ASSISTED_TIMING.md](ASSISTED_TIMING.md): compare character matching, tone-free syllable matching and anchored/approximate alignment; assess repeated sections, uncertainty and correction-time savings. Preserve all manual text/segmentation/timing until explicit proposal acceptance, with cancellation and undo. No automatic uploads, downloads or paid inference on ordinary edits.

## Known issues

- **Footage capture:** the server-side reference helper aborts in bundled ffprobe/libavdevice because macOS AVFoundation lacks `_AVCaptureDeviceTypeContinuityCamera`. Use the owner’s working Chrome/client-side path for the outstanding M0/M1 footage checks.
- **Root static checks:** unused `useId` imports in two footage components and missing TypeScript JSON-module configuration for Lotties were reported. Recheck these before planning repairs; static-check failures alone do not establish a playback/render failure.
