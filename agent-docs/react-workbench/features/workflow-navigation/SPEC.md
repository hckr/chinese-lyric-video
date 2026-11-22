# Workflow navigation

**Status** — Implemented in 0.4.0.

The sticky header contains Import, Translations, Timing, Video and Export. It shows the open song, application version, save status, Undo, Redo and JSON download. Translations counts reviewed shared phrases. Timing counts occurrences with valid reviewed intervals for the linked audio duration. The selected workspace uses a separate active indicator. Narrow screens use a labeled native select.

Workspace changes retain project history and the local audio file. Leaving Timing pauses playback. Group duplication makes the header inert until confirmation or cancellation. Header measurements maintain the scroll offsets used by the inspector and timeline.

The import browser workflow opens all five workspaces at desktop and 390px. Timing and grouping browser checks exercise native playback, sticky panels and duplicate isolation. The desktop header follows the reference with a music icon, connected numbered steps, a check for a loaded project, and a blue active step. The design reference is in [assets](assets/README.md).

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
