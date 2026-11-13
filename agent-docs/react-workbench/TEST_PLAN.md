# Acceptance tests and regression plan

Apply the tests at the checkpoint they first become relevant. Use tests that fit the existing tooling; do not install software just for visual screenshots.

## M0 — baseline / preservation

- [ ] `git status --short`, `git diff`, staged changes and untracked Streamlit/Python files examined and documented.
- [ ] Current song files and all registered Remotion composition IDs, FPS, durations, dimensions, aspect ratios, audio origins, backgrounds, thumbnails inventoried.
- [ ] Reference frames or still captures saved for at least one **music-video**, **image + visualizer** and each **thumbnail family** at representative timestamps; originals retained.
- [ ] Existing CLI Remotion render and Python tests documented; no local user work discarded.

## M1 — editor/import/export

- [ ] Import at least two real existing song TS modules; support consts/references/spreads/`as const`/Hanzi keys/known getter; unsupported expressions fail visibly without mutating editor state.
- [ ] Export/re-import preserving normalized metadata, occurrence IDs/order/keys/times, translations, Pinyin, multiline glosses, empty-Hanzi grammar tokens.
- [ ] UI can **merge adjacent lexical tokens** and **split a lexical token** at a chosen Hanzi boundary, with editable Pinyin/gloss, note preservation, review invalidation and undo/redo. Verify export/reimport; see `WORD_SEGMENTATION.md`.
- [ ] A single `漂亮` word uses `piàoliang` in editor, Python output and TS export (never `piào liang`); distinct tokens appear separated in full-line Pinyin (`wǒ xǐhuan`); apostrophes (`nǚ'ér`), accents and contextual-note tokens remain intact. Imported manual spacing errors are flagged without silent rewrites.
- [ ] Split/merge changes do not alter phrase translation, repeated occurrences, timestamps or unrelated word tokens.
- [ ] Repeat chorus appears N times in timeline but one unique phrase is edited; modifying the phrase updates every displayed instance.
- [ ] Raw lyrics with repeated line and section heading preserve occurrence order, report unassigned timings.
- [ ] Legacy TS output typechecks against actual Remotion song consumers; old renderer can render a manually copied file.

## M2 — timing

- [ ] Import `startMs=12345`, `endMs=12789`; exact values survive save/reload/export/re-import (unless user edits them).
- [ ] Select the second of three occurrences referring to one phrase; change its start/end; no other occurrence changes.
- [ ] Load local audio; playhead uses actual media currentTime, pauses/stops correctly, scrubs and seeks accurately enough for human sync.
- [ ] Press `S`/`E` at known audio times; exported milliseconds match selected position within appropriate media clock precision.
- [ ] Drag/trim and exact numeric edit work; undo/redo works; invalid `end<=start` rejected with intelligible feedback.
- [ ] Gap/overlap allowed but labelled; unsynchronized entries block/warn depending on export target; no silent auto-correction.
- [ ] Timeline not flattened to unique phrases; keep consecutive and repeated occurrences.
- [ ] Keyboard shortcuts do not activate while editing text; touch or keyboard users can perform key timing adjustments.

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
