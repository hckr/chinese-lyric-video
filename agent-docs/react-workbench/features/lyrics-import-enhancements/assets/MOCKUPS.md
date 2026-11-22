# Import UX – visual implementation references

These mockups update the visual/interaction direction for `features/lyrics-import-enhancements/EDITOR_UX.md`. Use them to reconcile the current implementation and specifications, **not** as a replacement for data contracts and acceptance criteria.

## Files

| File                | State                  | Purpose                                                                                                                                                                                                                   |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor.png`        | Source editor          | Primary compact screen; initial lyrics are ungrouped and the preview remains collapsed.                                                                                                                                   |
| `ai.png`            | AI review + diagnostic | Suggestions are anchored to editor positions, reviewed one at a time in the right rail; length errors are visible inline.                                                                                                 |
| `audio.png`         | Audio comparison       | Prioritized detected passages; successful matches stay collapsed; review insertion with waveform, timestamps, target position, and preview.                                                                               |
| `editor-mobile.png` | Narrow screen          | Stack editor and preview, keep essential actions reachable, avoid horizontal scrolling.                                                                                                                                   |
| `preview.html`      | All above              | Self-contained static HTML/CSS visual prototype. Open locally with `?state=editor`, `?state=ai`, or `?state=audio` to inspect the respective state. These controls are presentational only, not a functional application. |

## Invariants, independent of the screenshots

1. The lyric text editor is the **only editable source representation** of line content, order, and section boundaries. The structure preview is read-only; clicking a section or line can navigate to its location in the editor.
2. Standalone `[Section name]` starts a new section. A blank line or `[/]` ends a section and returns to ungrouped lyrics. A new heading implicitly ends the previous section. There is no bracket-escaping requirement for original lyrics.
3. Pasted lyric order is assumed correct. AI must not rearrange lyrics. Only audio discoveries may propose **inserting new passages**, and insertion requires explicit acceptance and a reviewable target location.
4. The shared 11-element rule is enforced before creating new occurrences; show inline diagnostics and suggested splits, allow manual line breaks, and block import on unresolved violations. Counts shown in screenshots are illustrative.
5. AI creates pending changes, never silently alters user lyrics or headings. Accept/Dismiss acts on a targeted suggestion; it must not dump all suggestions into a separate full-length form. Invalidate stale suggestions after relevant edits. Accepted edits update the read-only preview.
6. In audio comparison, prioritize unmatched audio passages, then uncertain alignments. Keep matched occurrences collapsed by default. A transcription mismatch is evidence for review, not proof of incorrect pasted lyrics.
7. Approving an audio-discovered passage inserts it into the shared editor with provenance and timing metadata. A passage over the 11-element limit must have valid text and timestamp splits before acceptance. Preserve actual pauses; do not proportionally divide time without reliable evidence.
8. Review states must be compact: **do not expand all lyric occurrences or all matches into the document's page height**. Use bounded viewports, navigation, and/or contextual inspectors. Avoid nested scrolling within several vertically expanding accordions.
9. Existing project edits must retain occurrence identity, translations, timestamps, timing review state, saved audio, and undo behavior. Replacement imports remain transactional. Legacy ungrouped gaps round-trip through `[/]` where needed.
10. These mockups intentionally omit detailed word segmentation review. The existing segmentation pipeline should remain intact; the Translations UX is a separate decision.

## Implementation notes

- Continue using the existing dark theme, top workflow navigation, and existing editor/component infrastructure where practical. No dependency installation is implied by the mockups.
- Do not interpret illustrative counts (77, 43, 34, 2), sample Chinese lines, mock waveforms, or provider names as fixed data requirements.
- Do not add a new global workflow step for audio comparison; it is an auxiliary view within Import. AI review remains a mode of the same editor.
- The right rail in the AI state switches between **Suggestions** and **Structure**; the Structure tab remains read-only.
- The prototype's top-right explanatory state label and bottom visual-prototype note are not product controls.
- Verify at 1600px desktop and 390px mobile widths. The HTML is not an application implementation and some interaction details still need integration with existing state logic.
