# Timing editor — UX and implementation contract

## What problem it solves

Today timestamps are hand-edited in a song `.ts`, then verified through repeated Remotion preview playback. Build a **musically usable timing workspace** in React, backed by the **same occurrences exported to `TIMELINE`**. A repeated chorus phrase can have one translation but different start/end pairs for each occurrence.

## Layout

- **Top:** transport controls (play/pause, seek, current time/duration), audio load/reload, playback speed (optional), loop selection, `Set start` / `Set end` buttons.
- **Left:** ordered occurrence list (index, Hanzi, start/end, status), not deduplicated phrase list. Clicking selects and seeks; preserve all repeats.
- **Center:** zoomable timeline with horizontal waveform, ruler and labelled lyric blocks, playhead and draggable start/end handles. A light overview/minimap may help long songs.
- **Right inspector:** selected occurrence and its shared phrase, exact integer `startMs` and `endMs` editable directly, duration, previous/next occurrence, nudge presets (`±10 ms`, `±100 ms`), gap/overlap notice, jump to phrase review.
- **Preview:** optional small synchronized lyric frame (mock first, actual Remotion Player later). Avoid committing to full-fledged DAW features now.

## Interaction details

1. Import `.ts` → keep all existing timestamps and occurrences unchanged; load audio/video separately through File picker. For raw lyrics create **unassigned** times (`null` in project JSON; explicit error/warning on `.ts` export), not plausible timings.
2. Click ruler/waveform to seek. Drag a block to shift start and end together; drag left/right edges to trim. Clamp to `[0, mediaDuration]` when duration is known; prevent negative/zero-length cues. **Do not silently move neighboring cues**.
3. Use `Set start` / `Set end` at the *current audio position* during playback (tap-to-sync). Support keyboard shortcuts when not focused in text inputs: `Space` play/pause, `S` set start, `E` set end, `Left/Right` seek or selected-boundary nudge with a deliberate modifier, `[` / `]` go to prior/next cue; document keys in UI. Ensure shortcuts don't hijack typing.
4. Use numeric field inputs with either `mm:ss.mmm` or raw millisecond editing; show both. Nudge handles by 10/100ms and optionally frame-sized steps. Include undo/redo for timing edits and a reset-to-imported snapshot.
5. Waveform should be computed from **local audio** with Web Audio decoding and downsampled peak arrays; don't send audio to a third party. For long files, guard against high memory use and provide a flat timeline if analysis fails. The illustrative HTML reference has a synthetic waveform and is not proof of waveform analysis.
6. Use `<audio>` (or a single video media element) as the playback source and `media.currentTime` as the clock. Refresh playhead with `requestAnimationFrame`, but never use animation frame elapsed time as audio truth. Use object URLs only while the file is loaded, revoke safely on replacement/unmount. On reload, prompt to reselect unavailable local files rather than showing fake playback.
7. Zoom around cursor/selection, keep horizontal scroll position stable, and use appropriate pointer capture for drag. Mouse, touch and keyboard should all work. Allow explicit overlapping cues (sometimes intentional) and silence gaps; flag them visually. Explicit snapping options: off, frame boundaries or neighboring edges; **off by default**.
8. Timing edits update only the selected **occurrence**, never the shared phrase dictionary or its review status. Translation edits still update all occurrences using the phrase.
9. Save project JSON and export TS: match IDs/order/`lyricKey` and every `startMs`/`endMs` exactly (unless deliberately changed). Include unsynchronized warnings before exporting. Avoid rounding drift: authored milliseconds stay integer; frame conversion is a renderer concern.

## MVP vs later

**Timing MVP** (after file-based editing): local audio file, waveform (or degraded ruler if analysis fails), seek/play/pause, occurrence blocks, drag/trim, exact inputs, start/end capture at playhead, undo, export and validation. Do not require Python AI or the Remotion refactor.

**Later:** actual Remotion Player synced with audio, automatic/assisted alignment, word-level timing, beat detection, multiple audio channels, fine-grained video timing, per-section markers. These are *not* prerequisites.

## Edge cases and tests

- Imported timestamps such as `12345` and `12789` remain exact across import/export/re-import. Never auto-quantize to `30fps` grid when loading.
- The same `lyricKey` occurs at 10s and 45s: editing second occurrence does not change first; editing translation changes both.
- Select at 23.000s, press `S`, select at 24.750s, press `E`: interval is exactly `[23000, 24750)` on export.
- Prevent `endMs <= startMs`, negative values, past-duration edits when known, and invalid numeric inputs; preserve the last valid edit and show an error.
- Preserve intentional overlaps; distinguish warnings from blocking errors.
- Undo/redo survives dragging one occurrence and then editing another; never changes unrelated phrase text.
- Audio/video files can be unplayable, unsupported or missing; present actionable error and retain project data.
- At 30fps and 60fps, check that frame rounding matches actual legacy renderer. Verify end-of-song and intro/outro boundary behavior.
- No file mutation occurs outside explicit user export.
