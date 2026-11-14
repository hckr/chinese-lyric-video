# Acceptance tests and regression plan

Apply the tests at the checkpoint they first become relevant. Use tests that fit the existing tooling; do not install software just for visual screenshots.

## M0 — baseline / preservation

- [x] `git status --short`, `git diff`, staged changes and untracked Streamlit/Python files examined and documented.
- [x] Current song files and all registered Remotion composition IDs, FPS, durations, dimensions, aspect ratios, audio origins, backgrounds, thumbnails inventoried.
- [ ] Reference frames or still captures saved for at least one **music-video**, **image + visualizer** and each **thumbnail family** at representative timestamps; originals retained.
- [x] Existing CLI Remotion render and Python tests documented; no local user work discarded.

## M1 — editor/import/export

- [x] Import at least two real existing song TS modules; support consts/references/spreads/`as const`/Hanzi keys/known getter; unsupported expressions fail visibly without mutating editor state.
- [x] Export/re-import preserving normalized metadata, occurrence IDs/order/keys/times, translations, Pinyin, multiline glosses, empty-Hanzi grammar tokens.
- [x] UI can **merge adjacent lexical tokens** and **split a lexical token** at a chosen Hanzi boundary, with editable Pinyin/gloss, note preservation, review invalidation and undo/redo. Verify export/reimport; see `WORD_SEGMENTATION.md`.
- [ ] A single `漂亮` word uses `piàoliang` in editor, Python output and TS export (never `piào liang`); distinct tokens appear separated in full-line Pinyin (`wǒ xǐhuan`); apostrophes (`nǚ'ér`), accents and contextual-note tokens remain intact. Imported manual spacing errors are flagged without silent rewrites.
- [x] Split/merge changes do not alter phrase translation, repeated occurrences, timestamps or unrelated word tokens.
- [x] Repeat chorus appears N times in timeline but one unique phrase is edited; modifying the phrase updates every displayed instance.
- [x] Raw lyrics with repeated line and section heading preserve occurrence order, report unassigned timings.
- [ ] Legacy TS output typechecks against actual Remotion song consumers; old renderer can render a manually copied file.

## M2 — timing

- [x] Import `startMs=12345`, `endMs=12789`; exact values survive save/reload/export/re-import (unless user edits them).
- [x] Select the second of three occurrences referring to one phrase; change its start/end; no other occurrence changes.
- [x] Load local audio; playhead uses actual media currentTime, pauses/stops correctly, scrubs and seeks to the requested media position in the browser tests.
- [x] Press `S`/`E` at known audio times; exported milliseconds match selected position within appropriate media clock precision.
- [x] Drag/trim and exact numeric edit work; undo/redo works; invalid `end<=start` rejected with intelligible feedback.
- [x] User-reviewed timing policy: normal gaps are allowed without warnings; imported overlaps are flagged without changing data. Draft overlaps are allowed both during previews and after final edits, with warnings; unsynchronized exports warn.
- [x] Timeline not flattened to unique phrases; keep consecutive and repeated occurrences.
- [x] Keyboard shortcuts do not activate while editing text; keyboard timing adjustments are covered by browser tests.

The user accepted manual testing as sufficient on 2026-11-14. M2 is accepted within the executed checks above; actual touch interaction and perceptual synchronization quality have not been independently verified. Evidence and limits: [CHECKPOINT_B.md](CHECKPOINT_B.md). M0/M1 results and remaining partial gates are detailed in [CHECKPOINT_A.md](CHECKPOINT_A.md); the open footage-reference and Python generation gates are not closed by M2 acceptance.

## M3 — Python AI

- [ ] Existing local Python unit tests retained; no duplicate TS reimplementation of established NLP/dictionary logic.
- [ ] Generate unique-phrase draft, inspect dictionary entries and prompt provenance, accept/revise without losing manual modifications.
- [ ] Failed/canceled/retried AI request preserves editor state; no unexpected automatic paid calls; API keys not present in browser bundle.
- [ ] LLM prompts/postprocessing output contiguous Pinyin **per lexical word** and validate the resulting segmentation; regenerated drafts never silently overwrite manually approved split/merge edits.
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
