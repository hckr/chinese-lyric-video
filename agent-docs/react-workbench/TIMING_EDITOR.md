# Timing editor — behavior and interaction contract

## Purpose and status

This describes the **committed manual editor**. The separately [reconciled Automatic Timing & Review spec](features/automatic-timing-review/SPEC.md) defines the desired review/reset/settings workflow and proposed completion plan; it is not yet implemented.

The React Timing workspace edits each lyric occurrence independently and exports those times through legacy `TIMELINE`. Repeated phrases share translations, not timestamps. Audio playback is required to synchronize and check timestamps; the current local audio/video picker is one way to select that source, not a permanent navigation requirement.

Manual timing was accepted by the owner on 2026-11-14. Source inspection confirms the behavior below; touch operation and perceptual synchronization were not independently verified. Outstanding checks are in [TEST_PLAN.md](TEST_PLAN.md). Operating steps and existing optional shortcuts are in [web/README.md](../../web/README.md#timing-workflow-checkpoint-b).

## Data and playback

- Preserve imported IDs, ordering and exact integer milliseconds without quantization. Raw occurrences start with null boundaries; draft TS exports use warned zero placeholders. Assigned intervals must have a nonnegative start and later end within known media duration. Applying invalid field values shows an error and leaves saved occurrence times unchanged; the entered values remain visible for correction.
- Ordinary single-occurrence timing edits affect only that occurrence, without changing phrase text, translation or shared phrase-review state. There is currently no occurrence timing-review state. Preserve deliberate gaps. Overlaps produce warnings; other occurrences keep their timings except for explicit group operations described below.
- One native media element owns playback. Its `currentTime` is authoritative; animation frames refresh the playhead rather than supplying a second clock. Playback pauses when leaving Timing. Manual playback and waveform analysis use browser-local data; no media is uploaded.
- Waveform analysis is bounded; results from replaced media are ignored. Unsupported codecs or analysis limits retain playback and ruler editing when the browser supports the file. See the media code/tests for decoding and resource limits.
- Session object URLs are revoked on replacement/unmount. JSON saves lightweight audio metadata and timing baselines, not media bytes, absolute paths or URLs; reopening requires relinking. Audio selection stays independent of undo/redo history.

## Selection, editing and viewport

The workspace has playback controls, a chronological occurrence/group sidebar, waveform/ruler and selected-occurrence inspector. The inspector provides start/end fields in integer milliseconds with Apply timing, a fixed-height text preview, equal-width Previous/Next/Translate navigation, Remove lyric and Reset timing actions. The text preview is not a Remotion render.

Selecting a sidebar row or timeline block seeks to its start whether paused or playing, reveals it in both timeline axes and scrolls the sidebar. Translate opens the shared phrase editor. Clicking the ruler/waveform seeks; dragging a body shifts both boundaries while an edge trims one. Media bounds and positive duration remain enforced. Each drag commits one undo entry. Reset is undoable and restores that occurrence's saved timing snapshot. On import or load, a project without a snapshot copies its initial occurrence timings, including null boundaries for raw lyrics. The proposed review flow instead separates latest automatic and last-reviewed snapshots; see the feature SPEC §6.

Zoom defaults to 8×, supports 1× through 32× and increases ruler density. With a soundtrack loaded, zoom uses the playhead position as its reference; otherwise it uses the selected occurrence’s start time (or zero if unassigned). Neighbor-edge snapping defaults on with a 100 ms threshold; Off remains available.

While paused, background hand-drag pans; clicking without dragging seeks. During playback, follow scrolling moves the playhead from 15/16 to 1/16 of the visible width, clamped at song boundaries. Programmatic selection/zoom follow scroll smoothly; hand-panning is immediate. Pausing cancels follow animation.

## Occurrences and groups

Timing → Repeat inserts a shared-translation occurrence after its source with copied timing, allowing an expected overlap. Removing a phrase's last occurrence requires confirmation and removes the phrase; undo restores the occurrence and shared phrase data.

Grouping is defined in [the grouping specification](features/lyrics-grouping/SPEC.md).

## Executable references and open proposals

[timing.ts](../../web/src/timing.ts), [useLocalAudio.ts](../../web/src/useLocalAudio.ts) and [waveform.ts](../../web/src/waveform.ts) define timing, media and waveform operations. [Timing domain tests](../../web/tests/timing.test.ts) and [browser timing acceptance](../../web/tests/timing-browser.ts) cover editing, audio clock/waveform, history/reset, relinking and exports. Renderer frame conversion and incomplete reference-render coverage belong to [REMOTION_REFACTOR.md](REMOTION_REFACTOR.md).

Cursor-anchored zoom, an overview/minimap and a resizable/collapsible inspector remain undelivered proposals; they do not reopen accepted B. Actual Remotion Player synchronization is E work. [Assisted known-lyrics alignment](ASSISTED_TIMING.md) records evaluation evidence and safeguards; word-level timing, reliable beat detection, multiple audio channels, fine-grained video timing and section markers remain future possibilities. Manual timing does not require Python AI or the Remotion refactor.

## Planned extensions

The [approved Automatic Timing & Review specification](features/automatic-timing-review/SPEC.md)
owns forthcoming generation, review/reset, replay and settings behavior. The live
playback preview, linked-edge edits and related controls are not part of this
committed baseline. Use the existing manual workflow until feature implementation
is available.
