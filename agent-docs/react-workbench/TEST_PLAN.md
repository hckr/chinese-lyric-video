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

## M3 — Python AI

- [ ] Existing local Python unit tests retained; no duplicate TS reimplementation of established NLP/dictionary logic.
- [ ] Generate unique-phrase draft, inspect dictionary entries and prompt provenance, accept/revise without losing manual modifications.
- [ ] Failed/canceled/retried AI request preserves editor state; no unexpected automatic paid calls; API keys not present in browser bundle.
- [ ] AI output and proposal acceptance satisfy the [segmentation/Pinyin contract](WORD_SEGMENTATION.md).
- [ ] Repeated phrase reuses the same translation; individual occurrence timing survives translation edits.

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
