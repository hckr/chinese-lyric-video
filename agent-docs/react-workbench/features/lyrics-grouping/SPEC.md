# Lyric grouping — implementation spec

Implement this feature in the **current local React workbench**, adapting to its existing components and data structures. Existing grouping-related sidebar logic may already be present; extend it rather than duplicating it. The timeline in the local working tree includes changes not yet committed, so use the **current working tree**, not the repository's published timeline, as the implementation baseline.

## Visual references

| File                                                                       | Purpose                                                                                                                     |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [`assets/grouped-ui.png`](assets/grouped-ui.png)                           | Overall idea for grouped sidebar, group menu, and integrated timeline group handles.                                        |
| [`assets/mixed-grouped-ungrouped.png`](assets/mixed-grouped-ungrouped.png) | **One group among ordinary ungrouped rows**; ungrouped rows stay visually ordinary.                                         |
| [`assets/duplicate-positioning.png`](assets/duplicate-positioning.png)     | Transient duplication mode: ghost is draggable, name and confirmation controls are present, the rest of the UI is disabled. |

**Mockups are conceptual UX references, not pixel-perfect requirements.** In particular, do **not** copy their slightly different background/colors, literal lyric text, counts, timestamps, coordinates, or incidental AI-generated details. Keep the existing app's visual language and real data. Implement the behaviors described below, not a screenshot recreation.

## Goal and invariants

Group consecutive lyric occurrences into named, collapsible units so an entire passage (e.g. a chorus) can be duplicated and shifted together on the timeline while preserving **every member's duration and relative timing**.

- Each group has a stable ID, editable name, and stable member occurrence IDs. An occurrence can belong to **at most one group**; no nested groups.
- A new group comprises **at least two consecutive, currently ungrouped occurrences** in the displayed sidebar. Membership is fixed until the user ungroups/deletes it.
- Timing edits may later cause unrelated occurrences to fall chronologically between group members. **Do not split the group or prevent the edit.** Warn, using the existing warning conventions.
- The group time range is **derived** from timed members: `start = min(starts)`, `end = max(ends)`; do not store separately mutable group times. Untimed members remain members.
- Preserve data through the existing project serialization/load mechanisms; do not introduce a parallel source of truth.

## Sidebar and group creation

1. Keep the sidebar's present width, lyric-row treatment, and selected-row styling. Add a compact **+ Group** action near `Lyrics N`.
2. **+ Group** starts a temporary range-selection interaction **in the existing list**. Start with the selected ungrouped occurrence as the first boundary and reveal it smoothly; if it is grouped, ask for the first ungrouped occurrence. Hover previews the inclusive range with First/Last labels; clicking the endpoint locks the range until **Adjust range** is chosen. Existing groups block crossing. Reserve boundary-label space so hover never resizes rows. Show a compact, stable-height status area, an initially empty group-name input and equal-height **Cancel / Adjust range / Create** actions, with Create on the right. Esc cancels without changing the original selection. Do not render a second lyric list in a dialog.
3. Render group headers with disclosure chevron, name, occurrence count, derived time range (when available), an accent color, and a genuine **three-dot overflow button (`…`)**. Expand/collapse group members; keep the current occurrence selection independently of expanded state.
4. Anchor the group overflow menu to the **sidebar group header**, not the timeline. Actions: **Duplicate…**, **Rename…**, **Ungroup**, **Delete group**. **Do not display keyboard shortcut labels**; the app has not implemented those group-action shortcuts.
5. **Ungroup** removes grouping only, retaining every occurrence. **Delete group** removes the group and its occurrences after a destructive-action confirmation. Renaming keeps identity and timing intact.
6. Render **ungrouped occurrences as ordinary standalone rows**, directly before, between, or after groups as required by time order. Do not place them in a synthetic “Ungrouped” group or make them inherit group coloring. See `mixed-grouped-ungrouped.png`.
7. Group-header warnings aggregate member warnings. Warnings remain visible even while the group is collapsed.

### Chronological ordering

Sort the **top-level units** by their earliest assigned start time: each group counts as one unit, and each ungrouped occurrence counts as one unit. Sort occurrences **inside each group** by start time as well. Keep ordering stable for equal timestamps using stable IDs/original ordering as tie-breakers; keep unassigned units at the bottom. An entirely unassigned group remains one unit at the bottom. Group membership must remain visually contiguous even when individual timestamps would interleave other top-level items. Recompute ordering after timing edits, movement, duplication, loading, etc., while retaining selection by ID.

## Timeline: group movement

- Use an **integrated thin colored bracket/rail above a group's lyric blocks, with a compact draggable handle**, as in the grouped mockup. Do **not** add a full-height separate Groups track.
- The bracket spans the group's derived range, uses the sidebar accent, and clearly identifies member blocks when the group is selected. Handle access/focus/hover should communicate group movement.
- Dragging the **group handle** moves all timed members by the **same offset**; dragging/trimming an individual block changes only that occurrence. Preserve existing individual-block interactions.
- Snap **the shared group offset** using the timeline's existing snap setting (e.g., against its leading boundary); **never snap each member independently**. Enforce a nonnegative earliest start by clamping the shared offset rather than adjusting members separately. Durations and internal gaps must remain bit-for-bit/equivalently precise with the app's time units.
- Group moves may cross or overlap other groups/occurrences. **Do not block** placement, push neighboring blocks, or introduce an “invalid move” mode. Keep group handles usable where their ranges overlap (z-order/selection handling as necessary).
- Preserve the current timeline zoom, snapping, keyboard-based individual occurrence editing, audio/waveform, and other existing behavior.

## Duplicate…: explicit drag-and-confirm flow

**This supersedes the prior pointer-following, click-to-place design.** Duplication must have a temporary, isolated editing mode:

1. Choose **Duplicate…** on a group in the sidebar. Enter a transient **Duplicate group** mode **without changing persisted application data**. Show a visually distinct **ghost copy** of that group's bracket and all timed blocks on the timeline. Give it a reasonable initial placement near/after the original, clearly distinguishable from existing blocks.
2. **The ghost does not follow the mouse.** It stays put until the user **drags the ghost's own handle** horizontally. During drag, the whole ghost moves as one unit. It remains in the dropped preview position afterward; dropping does **not** finalize duplication.
3. Show a compact always-visible panel near/below the timeline with **New group name**, prefilled e.g. `Chorus (copy)`, and **Create copy** / **Cancel** buttons. The user can adjust the position repeatedly, edit the name, then explicitly commit.
4. While this mode is active, **lock other editing/selection controls**: existing sidebar items, original timeline blocks/group handles, normal editors, group menus, zoom/snap selectors, and audio controls cannot be modified or interacted with. Subtly dim them to indicate inactivity. **Only ghost dragging, name input, Create copy, and Cancel are active.** Permit passive timeline scrolling needed to reach a destination; keep zoom/snap behavior fixed at the values present when mode began.
5. Snapping works on the ghost's **single shared offset**, using the frozen snap setting. Keep all relative starts/ends/durations/gaps exactly unchanged. Do not permit time below zero (clamp shared offset). **Preview overlaps and interleaving with warnings but never block the user.** An overlap does not disable **Create copy**.
6. **Create copy** atomically creates **new group and occurrence IDs** with the entered name, copied lyric content, original membership order, and the ghost's finalized time offset. Save through the usual state model, restore normal interactions, reorder the sidebar chronologically, and select the new group.
7. **Cancel** or Esc discards the ghost and name, restores the normal UI, and changes **nothing** in app/project data. Do not create temporary real occurrences that would leak into persistence or history.
8. If some members have no timing, duplicate them as untimed members. If **none** has timing, use the same name-and-confirm UI without a draggable ghost, duplicating the group as unassigned.

## Warning behavior

- Preserve the app's **current per-occurrence overlap warnings** in the sidebar. Group headers aggregate warnings from members.
- Timing **interleaving** is distinct from interval overlap: if an ungrouped occurrence or another group contains a start between starts of members of a group, preserve the group and warn (different tooltip explanation where feasible).
- Overlap/interleaving warnings are **non-blocking** for individual edits, whole-group movement, and duplication. No additional permanent application mode to resolve overlaps.

## Interaction quality

- Menus and small dialogs/popovers must remain usable within narrow sidebar scroll regions and not get clipped.
- Group actions, handles, and temporary mode controls need accessible labels, visible focus states, and appropriate Esc behavior. The duplication panel must clearly say that dragging the ghost previews its position and **Create copy** finalizes it.
- Avoid unrelated redesign, dependencies, a new keyboard-shortcut system, or refactors outside this feature.

## Acceptance checks

1. With only **one group**, all other occurrences are plain rows; the single group can sit between ordinary rows, per the mixed-state mockup.
2. Group a consecutive range of 4 ungrouped occurrences; create, collapse, expand, rename, ungroup; verify selection and ordering.
3. Move one occurrence within a group: other members don't move; group derived range and warnings update.
4. Move a group by +10.000 s: **every timed member's start and end move by exactly +10.000 s**, with all internal timing differences unchanged.
5. Move a group through another and leave it overlapping: operation commits; groups remain intact; existing warnings still work.
6. Choose **Duplicate…**: ghost appears **stationary**, independently draggable by its handle; releasing the mouse does **not** create a copy; name can be edited.
7. While duplicating, the rest of the interface is disabled; only the ghost, name, confirmation, cancellation, and passive viewport navigation work.
8. Cancel after moving the ghost and editing its name: **no change to persisted data**. Repeat and confirm: new IDs, name, correct timing offsets, sidebar reordering, new group selected.
9. Duplicate onto other content: warnings appear, but **Create copy remains possible**.
10. Groups and standalone rows reorder by time at the top level, groups remain contiguous, unassigned rows remain visible.
11. Original timeline drag/trim, snapping, zoom, audio, selection, existing shortcuts, warnings, and project save/load still function after leaving duplicate mode.
12. Group menu is in the sidebar, its trigger uses **three dots**, and the menu contains **no shortcut labels**.

Implement with the local project's existing patterns and run the relevant checks/tests already available in the repository.
