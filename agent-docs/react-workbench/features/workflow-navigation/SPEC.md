# Workflow navigation — proposed feature

**Area:** React workbench application shell
**Status:** Extracted/reconciled 2026-11-18; proposed, unprioritized, not approved for implementation.
**Scheduling:** [ROADMAP](../../../ROADMAP.md). Independent of [Automatic Timing & Review](../automatic-timing-review/SPEC.md).

## Objective and current implementation

Replace the left page menu with a compact top workflow header, keeping free movement
between existing workspaces. Retain the current dark visual language, project
identity, app version and global actions.

Source: `web/src/App.tsx` renders a `.navigation` aside, five workspace buttons,
project information, and a main header with Undo/Redo and Download project JSON.
Workspace switching uses React `screen` state, not URL routes. Existing actions
close dialogs/repeat UI and preserve project/history. `useLocalAudio.ts` pauses
when Timing becomes inactive. Keep these logical routes and lifecycle behaviors;
this feature does not introduce a router or change persistence format.

| Proposed label | Existing screen/state | Completeness signal proposal                                                                                                                                                            |
| -------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import         | Import lyrics         | A valid current project exists; revisiting Import does not approve replacement.                                                                                                         |
| Translations   | Lyric editor          | Derive from all shared phrase review states and existing phrase/segmentation validation; never from visits alone.                                                                       |
| Timing         | Timing                | Once independent timing review exists, valid reviewed occurrences / all occurrences, plus untimed count. Until then show timing assignment counts without claiming reviewed completion. |
| Video          | Video settings        | No completion badge: actual render integration is unfinished.                                                                                                                           |
| Export         | Export data           | Show availability/warnings if useful; opening/downloading a draft is not proof of finished video or project completion.                                                                 |

Progress is guidance, not a wizard gate. Do not block manual Timing on translation
review or block returning to earlier screens. No inferred completed stage where the
application has no reliable signal. Source import protection remains the separately
proposed [import safeguards](../lyrics-import-enhancements/SPEC.md).

## Layout and interaction

Use [assets/README.md](assets/README.md) and its header image as conceptual references.
Suggested order: Import → Translations → Timing → Video → Export. Indicate current
workspace with `aria-current="page"`; keep status indicators distinct from selection.
The source prototype's v0.3.0 and completion badges are illustrative, not release
instructions or validated state.

- Preserve project title/artist, version from root package metadata, occurrence/
  shared-phrase counts where useful, browser-save feedback, Undo/Redo availability
  and portable JSON download. Keep actions available on every current workspace.
- Reuse existing buttons/handlers and focus/disabled conventions. Do not hardcode
  phase completion or copy demo lyrics/data.
- At narrow widths, wrap/stack the header or provide a labeled compact navigation
  control. No page-level horizontal overflow; do not make actions unreachable.
- Keyboard users can reach every screen and global action. Provide visible focus,
  text/accessible names for status icons and sufficient contrast; hover is not the
  only way to understand progress. Avoid frequent live announcements of counts.
- Retain workspace-specific sticky headers, modal/inert duplicate-group protection,
  scroll-reveal offsets and audio pause/relink behavior. Audit selectors targeting
  `.navigation` before moving it; do not break group ghost editing isolation.
- No changes to timing generation/review semantics, provider integration, video
  settings functionality, Remotion rendering or import replacement semantics.

## Proposed implementation/review boundary

After separate scope approval: (1) define reusable completeness selectors from real
project state, (2) restructure shell navigation while reusing handlers/actions,
(3) adapt responsive/sticky/focus/inert behavior, (4) run all five workspace flows
and dedicated desktop/narrow keyboard checks. Review this as its own feature and
commit scope; it is not a prerequisite for finishing Timing. Apply the version
convention at that separately accepted task, without taking the mockup version.
No new dependencies are anticipated.

## Acceptance criteria

- All five existing logical screens and their state/history remain reachable,
  including no-project import/export states and incomplete projects.
- Navigating does not replace/reset the project, lose edits, auto-review anything,
  start inference, or bypass a pending confirmation.
- Completion badges/counts reflect actual domain validation; changing data updates
  them. Visits and draft downloads alone never produce a checkmark.
- Timing playback pauses on leaving Timing; return/relink behavior is preserved.
- Undo/Redo, download, app version and project identity remain usable at desktop
  and 390px viewport widths, with no horizontal overflow.
- Keyboard focus, accessible labels/current-screen indication and settings/dialog
  behavior pass. Group duplicate mode still isolates global navigation/actions.
- Existing browser import, editor, timing, group and export checks pass after shell
  changes; reference screenshots verify intentional layout changes.

## Decisions for that feature's approval

Exact sticky-header arrangement, mobile navigation treatment, whether Import should
show a completion badge or just project availability, and wording for partial
translation/timing progress remain design decisions. Timing review counts depend
on the new review contract; absent that metadata, do not simulate it. Video/Export
completion remains deliberately undefined until actual rendering scope is agreed.
