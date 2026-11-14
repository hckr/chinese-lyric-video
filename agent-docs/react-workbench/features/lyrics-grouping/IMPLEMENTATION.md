# Lyric grouping — implementation and verification

Implemented against the local worktree and [SPEC.md](SPEC.md). The spec supersedes the earlier mutable membership, internal reflow, numeric group placement and Move groups toggle designs.

## Behavior

- `+ Group` starts from the selected ungrouped lyric (or asks for a first lyric), reveals it and previews an inclusive range on hover. First/Last labels reserve stable row space. The endpoint click locks the range until Adjust range; existing groups block crossing. Create requires an explicitly entered name and at least two consecutive ungrouped appearances. The compact form has equal-height Cancel / Adjust range / Create actions and a stable status area. Cancel/Escape discards the range without changing selection.
- `GroupSidebar.tsx` renders chronological top-level group/standalone units and time-sorted children. Group collapse leaves occurrence selection intact. Headers have stable accent colors, derived ranges, warning summaries, and a sidebar-anchored `…` menu: Duplicate…, Rename…, Ungroup, Delete group. Portaled menus avoid scroll-container clipping; rename and destructive confirmation use in-app dialogs.
- `lyric-groups.ts` owns pure ordering, derived ranges/warnings, exact shared-offset movement, shared snapping and atomic duplication. Group membership is fixed until ungroup/delete; individual edits may interleave unrelated content without splitting a group. The project validator rejects shared/duplicate/missing memberships. Older projects without groups still load.
- `GroupTimeline.tsx` renders integrated thin rails and accessible compact handles. A group drag shifts timed boundaries together; an individual drag/trim retains its original occurrence behavior. Shared offset clamping preserves internal timing at zero. Placement overlap and interleaving remain non-blocking.
- Duplicate… creates only React preview state: stationary ghost blocks/rail, independent handle, name and explicit Create copy/Cancel. The source project and history stay untouched until confirmation. Existing controls are inert/dimmed and playback pauses; passive timeline panning remains possible. Zoom and snapping remain frozen. Confirm assigns fresh group/appearance IDs, preserves original membership order and untimed members, saves once, orders chronologically and selects the copy. Cancel/Escape changes no project data.
- App navigation and commit/load paths use the existing project model and grouped chronological ordering. Group metadata remains JSON-only; Remotion song output/compositions remain unchanged.

Sidebar dragging has been removed following review: rows and headers support selection, range creation, disclosure and menus only. Timing changes use the timeline's individual blocks or group handles. The obsolete sidebar reorder helper, drag preview and associated styles were removed. Regression checks assert non-draggable rows/headers and no project change from a sidebar drop.

## Checks actually run

- `npm run workbench:test`: **79 passed** in final checkpoint verification.
- `npm run workbench:test:lyrics-grouping`: passed. Implementation: `web/tests/lyrics-grouping.ts`. Covers mixed standalone/group rows, range creation, collapse/expand, rename, menu contents, +10,000 ms real pointer movement, independent member movement, interleaving/overlap, stationary ghosts, control locking, repeated ghost positioning, unchanged persisted data on Cancel/Escape, confirmation/new IDs/offsets/selection, ungroup, delete confirmation/Undo, fully untimed duplication and JSON reopen.
- `npm run workbench:test:cat-song-workflow`: passed with the complete supplied song, updated to the specified range/duplicate flow.
- `npm run workbench:test:browser`: passed M1 editor and M2 audio/timing regression checks, including real WAV playback/waveform, capture, drag/trim, shortcuts, history/reset, JSON/TS export/reimport, reload/relink and mobile layout. Its upload helper now waits for asynchronous local Python imports; its reset-button selector uses the current label.
- `npm run workbench:check`, production build, targeted ESLint, Prettier and `git diff --check`: passed.

Disposable evidence is in `output/playwright/lyrics-grouping/`: `mixed-sidebar.png`, `duplicate-preview.png`, `result.json`. Screenshots were visually inspected. `npm run workbench:clean` already covers this directory. All tests use temporary loopback servers and the installed browser; no browser/dependency installation or paid API request was needed. The user's running server/browser project was not restarted or modified.

This verifies the grouping feature and its editor/audio compatibility. It does not claim full-video rendering or complete Remotion visual equivalence. Nothing staged or committed.

## Current header and timeline layout

The arrow and group name form one collapse/expand button. Header warnings use a compact focusable icon with a custom dictionary-style tooltip, accessible description and one combined “Warning:” label. The tooltip is portaled outside scroll containers to avoid clipping. Group emphasis follows the selected member; there is no independent group selection. Menu items highlight on hover/focus, and rename dialog content aligns in a column. Timing’s Repeat action opens an in-app chooser.

`timeline-layout.ts` allocates contiguous group bands and adjacent rows for overlapping members. Drag previews retain committed row positions. After a drop, rows compact: nonoverlapping group ranges share vertical space with each other and standalone lyrics; overlapping members use adjacent internal rows. Empty capacity is discarded. Undo restores cached layouts. Group members share accent borders, selected members have stronger outlines, and the active group handle shows the lyric count and offset. All rows reserve rail space so grouped and ungrouped boxes align. Layout stays outside saved project data.

Latest verification: all **79** automated tests passed, including four layout regressions. Grouping, Cat Song workflow and general browser checks passed; TypeScript, targeted ESLint, Prettier and whitespace checks passed. Browser assertions verify frozen rows during dragging, equal-height action buttons, stable boundary-label heights, range locking/adjustment and the selected starting lyric. Nothing staged or committed.

Selection reveal covers both timeline axes, including tall layouts, and standalone selection uses the same bright outline as grouped selection. The grouping browser regression includes a crowded eight-group fixture for vertical reveal and custom tooltip checks.

Duplicate preview reveal: entering duplication scrolls the ghost handle into view through all scrolling ancestors, including the page, with reduced-motion support. It runs once on entry, so subsequent ghost drags/panning retain their coordinate space. A tall eight-group browser fixture checks vertical/horizontal handle and preview visibility plus unchanged saved data after Cancel. Confirmation still compacts the copy into the normal committed layout; temporary preview rows are not saved.
