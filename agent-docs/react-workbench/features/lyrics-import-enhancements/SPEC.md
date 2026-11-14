# Import view: live lyric grouping and project replacement protection

**Area:** React workbench → Import lyrics
**Status:** Feature proposal, independent of `features/lyrics-grouping/SPEC.md`
**Priority:** Replacement protection first; grouping after the grouping data model is available. AI-assisted inference can follow the AI translation integration.

## Objective

Make the raw-lyrics import view the natural place to review a song's structure **before** timing. As Chinese lyrics are pasted or edited, show a continuously updated, human-correctable grouping preview. Also prevent accidental replacement of the song currently being edited.

Use the current import view in the local application as the UI reference. Preserve its existing colors, typography, spacing and components; no screenshot or redesign is needed.

## A. Protect an open project from replacement

When an editable project is already open, entering **Import lyrics** shows the existing import UI in a visibly locked state. All operations that could replace the project are disabled (including file upload/drop and raw-text import), until the user explicitly chooses to start another import.

Present a short, prominent explanation and these actions:

- **Back to project** — return without changing anything.
- **Export project JSON** — use the existing portable export; keep the current project and the lock intact.
- **Replace current project…** — explicit acknowledgement/confirmation that a successful import will replace the current project. Then unlock the import controls for this import attempt.

The warning must not imply that opening the import view already discards anything: the current project remains untouched until a **successful, validated import** completes. Cancelling the confirmation or abandoning the new import leaves the current project intact. A failed file/raw import must not wipe it. If the user leaves and re-enters Import lyrics while a project is still open, require acknowledgement again.

Reuse any existing unsaved-work/replace protection rather than stacking competing confirmation dialogs. Browser-local autosave is **not** equivalent to a portable backup: offer the JSON export clearly. No new global modal or persistent app-wide mode is required; this is an import-view gate. Use actual disabled/inert form behavior, not just dimming, and make the unlock actions keyboard-accessible.

When there is **no** current project, the import controls are immediately available, unchanged.

## B. Live grouping preview for pasted lyrics

### User interaction

1. A user pastes lyrics into the current raw Chinese lyrics field.
2. A **Detected structure** preview updates as the text changes, without pressing Import.
3. The preview shows consecutive sections with their proposed names and contained lyric lines, plus any ungrouped lines. Group boundaries should be visually obvious without altering the pasted source text.
4. The user can correct the suggestions **before** importing: rename a group, adjust its start/end boundaries, remove a group, or group a contiguous ungrouped range. The UI may use a compact range editor rather than complex drag-and-drop.
5. **Import raw lyrics** creates the normal lyric occurrences and saves the accepted group structure with them. The timing editor sees the same groups; their timestamps remain unassigned as they do today.

Keep the textarea as a normal, editable source field. Place an always-visible compact structure preview immediately below or beside it within the existing right-hand card; allow expansion to inspect individual lines and boundaries. Avoid replacing the textarea with a new editor dependency merely to draw decorations. The preview is a **draft**, not a second editable lyric source.

Show a neutral **Suggested** state until confirmed/adjusted. If parsing has no plausible groups, show ordinary ungrouped lines and a concise “No groups detected” message; never fabricate confident structure merely to fill the UI. While editing, keep the import action and metadata inputs accessible when the page is unlocked.

### Inference rules and implementation phases

**Phase B1: immediate, deterministic inference (no AI dependency).**

- Recognize explicit headings such as `[Intro]`, `[Verse]`, `[Verse 2]`, `[Pre-chorus]`, `[Chorus]`, `[Bridge]`, `[Outro]` (case-insensitive); preserve the heading's intended label where possible.
- A heading starts a new section ending immediately before the next heading. Headings are **not** lyric occurrences. Process them **before** the existing import code discards section headings.
- Optionally use blank-line-separated stanzas as lower-confidence suggestions when there are no explicit headings; do not create a group from fewer than two resulting occurrences.
- Multiple choruses remain **separate group instances**, even if they have the same name and text. Repeated lyric lines retain their existing shared translation identity behavior, while each occurrence gets independent group membership.
- Punctuation splitting currently performed by raw import must be respected: group boundaries attach to the **resulting occurrences**, not assumed one-to-one source lines. Preserve source-to-occurrence mapping so preview, edits and final import agree.
- Suggestions must be contiguous, non-overlapping and optional; ungrouped occurrences are valid. Do not require every line to be in a group.

**Phase B2: AI-supported inference, after AI translation infrastructure exists.**

- Improve structural suggestions for unmarked lyrics (e.g. repeated multi-line chorus, verse vs pre-chorus). Reuse the app's AI infrastructure and review conventions rather than creating a separate service just for this feature.
- Show fast deterministic results immediately; AI refinement, if available, arrives asynchronously and is labeled as a suggestion. Do not send an AI request on every keystroke: debounce, cache per normalized source, and avoid re-running for unchanged text.
- AI must not silently overwrite manual group edits. Provide an explicit way to accept or dismiss AI refinements (or an **Improve suggestions** action) once the user has edited the proposed structure.
- AI failure/offline mode leaves the deterministic preview functional; importing raw lyrics must not depend on successful AI calls.

**Important:** “Immediately after text changes” means responsive local feedback. The app must not freeze while awaiting an AI response.

### Editing behavior

- Name changes, boundary adjustments and removed groups apply only to the draft preview until import is committed.
- Update automatic suggestions on source edits. Preserve unaffected user overrides if the corresponding source segments can be matched reliably. When an edit invalidates a manual range, show a clear indication that the affected suggestion needs review; never silently attach a group to the wrong words.
- Use the **same group/occurrence representation** as the grouping feature; do not create a second import-only group model that needs manual conversion later.
- Do not silently rewrite, normalize or delete lines in the user's textarea. Keep present raw-import behavior for actual lyric text and metadata.

## C. Consistency with the timing view

- Groups created on import remain intact when the song opens in the timing editor.
- Group membership is per occurrence; a group is an ordered, contiguous set in lyric order, regardless of its eventual timestamps.
- Untimed occurrences are valid. Assigned timestamps and overlap warnings are handled by the existing grouping/timing feature; this work must not redesign or override those interactions.
- Use a stable group ID and occurrence IDs rather than inferring membership later from repeated text.

## D. Future extension — YouTube URL import (not in this implementation)

Eventually the import view may accept a YouTube URL to propose **title**, **artist** and **lyrics**, then run the same grouping/review pipeline. This should be a separate later task, once the rest of the workflow is stable. Do **not** add a placeholder URL field, scraping implementation, dependencies or an AI/provider integration as part of this spec. The future design must account for source reliability, licensing and user review before importing lyrics.

## Acceptance criteria

### Project protection

- [ ] With an existing project open, import controls are visibly and functionally locked on entering the page.
- [ ] User can return to editing or export current project JSON without replacing it.
- [ ] Explicit replacement acknowledgement unlocks import; the existing project is preserved until another import succeeds.
- [ ] Cancelling, navigating away, invalid input and failed import do not discard the current project.
- [ ] With no project open, the original import workflow is immediately available.
- [ ] File picker, drag/drop, raw import, keyboard access and focus behavior respect the lock.

### Grouping preview

- [ ] Pasting or editing text updates the local structure preview immediately (without an import click).
- [ ] Explicit section headings produce labeled consecutive groups; headings do not become lyric occurrences.
- [ ] Preview supports a mixed sequence of grouped and ungrouped occurrences.
- [ ] A group can be renamed, removed or have its contiguous boundary edited before import.
- [ ] Repeated lines and repeated section headings create distinct occurrences/groups while preserving existing translation identity semantics.
- [ ] Preview and resulting imported groups agree even when punctuation splits a source line into multiple occurrences.
- [ ] Successful import creates groups compatible with the timing editor, leaving times unassigned.
- [ ] No AI service is required for the deterministic preview; if AI support is added, results are reviewable, throttled and non-destructive to manual edits.

## Scope and dependencies

Implement **A** independently. Implement **B1** when the existing group schema/import pipeline supports it. **B2** is a later enhancement contingent on the AI translation integration. **D** is explicitly deferred.

Inspect the current local workbench code first: existing import parsers, project state, autosave/export and grouping models take precedence over assumptions from public repository versions. Avoid unrelated refactors and do not alter the timing UI to implement this import-view feature.
