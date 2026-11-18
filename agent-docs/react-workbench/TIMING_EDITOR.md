# Timing editor — behavior and interaction contract

## Status and scope

Manual timing was owner-accepted on 2026-11-14. Automatic Timing & Review is complete. The [feature specification](features/automatic-timing-review/SPEC.md) owns its requirements and verification record. Navigation and bulk lyric reconciliation remain separate work.

## Data and migration

Each occurrence owns exact integer `startMs/endMs`, independent timing review, the latest regular automatic suggestion and its last-reviewed interval. Repeated phrases share text/translations but not timing review. Edits invalidate review only when bounds actually change; no-op edits retain it. Returning manually to reviewed values does not approve them. Linked touching-edge edits and group moves use the same mutation rules. Repeat/group copies keep current bounds and origin but start Needs review without either reset snapshot.

`schemaVersion: 1` remains unchanged. Shared schema ingress covers JSON import, browser recovery and the local timing API. Missing timing-review metadata migrates valid existing intervals to Reviewed/current-value reviewed snapshots; null, partial and invalid intervals stay unreviewed. Explicit Needs review survives reopening. Old `timingBaseline` is consumed and omitted on canonical save; it never supplies automatic provenance. Older strict readers may reject the added optional fields. Legacy TS still exports only its original timing/content fields; importing that TS treats its valid intervals as legacy Reviewed data.

Reset chooses the last-reviewed interval first, otherwise the latest automatic interval. Reviewed reset explicitly restores review, including after an explicit unreview at equal bounds. Equality and missing references have explanatory labels. Reset stays disabled when its target is outside the loaded audio. The snapshot remains available after relinking suitable audio. **Use latest automatic suggestion** explicitly assigns the latest regular interval as Needs review, preserving the reviewed reset target. Weak estimates require their own action and never become regular automatic provenance.

## Generation and pending work

Whole-song generation uses cached models or a matching Whisper word-timestamp JSON under **Advanced**. Invalid imports block generation until cleared or replaced. After generation, **Regenerate timing…** in the Timeline toolbar reveals the review counts, detected passages and regeneration controls. Audio goes only to the loopback worker; temporary uploads are removed. Regular valid results apply atomically as Needs review. Preserve-reviewed is the default; replace-all asks for confirmation in the app. An exact replacement of reviewed bounds retains review. Missing/weak results preserve existing current bounds and review. Cancellation, failed streams and later project/media edits prevent assignment of stale results.

Detected passages are optional individual additions, never automatic lyric replacement. Candidate IDs distinguish same-text passages at different times; duplicate clicks create one addition/history entry. Exact shared text reuses existing annotations. Add keeps the candidate list and current selection in context. View lyric reveals the new occurrence. Dismiss and Clear detected passages remove pending candidates from the saved project as an undoable action. A fresh run can detect them again. When pending candidates remain, regeneration asks before replacing that list on success. Detected passages retain the local dictionary draft, including available Pinyin. The Lyric editor lists phrases by their first occurrence. For previously added detected lyrics with no word breakdown, **Draft words and Pinyin** restores a local draft without changing text or timing. Both previews show the recognized text even without a word breakdown. Pending candidates, weak estimates, model/run references and normalized-audio identity persist in JSON; media/transcript bytes and object URLs do not. Undo restores an entire generation, candidate addition or review operation.

Audio identity is SHA-256 of mono 16kHz little-endian float32 samples produced from normalized PCM. Relinking requires checking this identity or explicitly authorizing reuse; unknown is not a match, and media replacement does not delete pending data. Renaming preserves identity, re-encoding may change it. Imported transcripts remain **external/unverified** even when the selected audio hash matches a saved recording.

## Review and settings

The sidebar, group summaries, timeline markers and inspector distinguish Reviewed, Needs review and Untimed. Untimed/invalid occurrences cannot be approved. Mark reviewed saves current bounds, then optionally advances through displayed grouped order, wrapping once and skipping reviewed/untimed rows. Advancing opens the destination group and leaves playback paused. The inspector reports completion and any remaining untimed rows. Secondary Select multiple mode offers in-app confirmation for bulk approval. Bulk approval and bulk unreview each create one undo entry.

The Timing settings button summarizes zoom, snap and linked edges. Its panel opens above or beside the trigger when space permits and uses a viewport-bounded overlay when space is limited. Opening it keeps the timeline layout in place. Escape and Done return focus to the trigger. Zoom (1–32×), neighbor snapping, linked edges, selected cached model, replay padding and auto-advance are project preferences. Defaults: 8×, edge snapping, linked edges off, medium model, 250 ms before/after and auto-advance on. Padding is independently configurable from 0–5000 ms; it never changes lyric boundaries. The existing speed and translation controls remain available.

## Playback and editing

One native media element owns playback and `currentTime`. Play lyric clips its padded range to the media; one-shot playback stops at that range end. Loop selected uses the same bounded playback mode. Global play/Space, selecting elsewhere, seeking outside the range, media replacement and leaving Timing cancel bounded conditions. Playback pauses when leaving Timing. Browser playback/waveform analysis stay local; only an explicit generation/identity request uploads to the local worker.

Exact fields, S/E capture, keyboard nudges, pointer body/edge edits, overlap warnings, group moves, history, bounded waveform decoding and the existing timeline viewport behavior remain available. Zoom anchors on the loaded playhead (otherwise selected start); paused background drag pans, and playback follows at the existing viewport thresholds. The text/audio preview is not a Remotion render.

Audio object URLs are session-only and revoked. Audio metadata stays consistent across undo/redo; reopening requires relinking media. Codec/analysis failure retains project data and manual editing. Generation supports at most eight minutes and 250 MB input, uses existing dependencies/cached models and never downloads them. A working installed decoder is needed for compressed media; mono 16kHz PCM WAV avoids that dependency.

## Verification and limitations

See [the feature verification record](features/automatic-timing-review/SPEC.md#16-implementation-and-verification-record) for commands, results and runtime limits. Domain and real-browser checks cover the review/reset/generation loop alongside manual M2 regressions. Perceptual synchronization and touch operation were outside the automated verification scope. Remotion preview/render integration, cursor-anchored zoom, an overview and a resizable inspector remain separate proposals.
