# Automatic timing & review — feature specification

**Area:** React Lyric Workbench → Timing
**Status:** Reconciled with local source on 2026-11-18; the owner has approved the nine decisions in §15. Implementation remains pending the separate documentation commit and checkpoint continuation. The manual editor is implemented; automatic-timing work is separate and uncommitted, and the review workflow below is not yet implemented.
**Priority:** Ongoing owner-requested timing checkpoint; completion sequence in §14 incorporates the approved decisions; documentation must be committed separately before implementation continues.

## 1. Objective

A user has imported a song whose **ordered lyric occurrences have no timestamps**. They open Timing, generate automatic timing suggestions, and verify/correct the results **one occurrence at a time using the existing timeline**. Automatic timing should eliminate repetitive manual setup without adding a second editor, a complicated setup form, or a global “preview → apply selected” ritual.

The primary flow is:

**Generate timings → listen → adjust when needed → mark reviewed → proceed to next lyric.**

The user can stop at any point, save project JSON, and resume. Automatic timing is optional; manual timing remains available. The algorithm's output is not presumed correct or automatically considered human-reviewed.

### Non-negotiable invariants

- **Occurrence identity matters.** Repeated text in separate choruses represents distinct occurrences with distinct timestamps and review states; shared phrase translations/segmentation remain unchanged.
- Generated timings target existing occurrences by stable occurrence ID. Never infer identity solely from lyric text or chronological position. **Existing “Detected from audio” candidates remain addable** as new occurrences after an explicit user action; candidate discovery alone does not change the lyrics.
- Preserve original imported lyric text, ordering/IDs, translations, segmentation approval, grouping and reviewed data. An audio transcript is **not** permission to replace the supplied lyrics; individually adding a user-selected audio-detected occurrence is allowed and must preserve the rest of the project.
- One existing Timing workspace remains the editing surface: sidebar, playback, waveform/timeline and selected-occurrence inspector. No separate suggestion editor or huge checkbox list above it.
- Timing review is independent of the existing **phrase/translation review** state.
- Timings use exact integer milliseconds and existing media bounds, undo/redo, persistence and legacy TS export behavior. No silent quantization.
- Local audio/media stays local. No automatic model downloads, external uploads or paid requests from merely opening Timing, loading audio, or editing lyrics.
- Treat the local checkout (including uncommitted work) and existing tests as authoritative for what is already implemented. This spec is a desired behavior contract, **not** a claim about the present code.

## 2. Scope and relationship to existing documentation

Read and reconcile with:

- `agent-docs/react-workbench/TIMING_EDITOR.md` — accepted manual editor and current imported-timing reset snapshot.
- `agent-docs/react-workbench/ASSISTED_TIMING.md` — evaluation evidence and alignment safeguards; this SPEC owns the approved interaction/review contract.
- `agent-docs/react-workbench/features/lyrics-grouping/SPEC.md` — group identity, repeat semantics and timeline interactions.
- `agent-docs/ROADMAP.md`, `web/README.md`, `AGENTS.md` — planning, documentation and owner-review rules.
- Actual frontend, state/schema, Python alignment/orchestration and tests in the local checkout. The screenshots are simulated UX references, not evidence of committed functionality.

**In scope:** Simplified automatic-timing entry point, generation progress/results, individual review, bulk-review convenience, explicit reset semantics, replay segment controls, timing preferences, persistence/migration, and safe regeneration behavior.

**Related but separately scoped:** [Workflow navigation](../workflow-navigation/SPEC.md) is a separate, unprioritized proposal. Its approval, implementation and tests are independent of this Timing feature.

**Not authorized by this proposal:** A new bulk transcription-to-lyrics replacement/merge engine, word-by-word karaoke timing, a new AI provider, model downloads/installations, automatic lyric deduplication, YouTube scraping, Remotion refactor, or changes to existing translation content. **Individual per-segment “Detected from audio” addition remains in scope; reuse the separately evaluated candidate work when implementation resumes.**

### Authority after reconciliation

This SPEC owns desired Timing review behavior; [TIMING_EDITOR.md](../../TIMING_EDITOR.md)
and [web README](../../../../web/README.md) describe current operation, and
[ASSISTED_TIMING.md](../../ASSISTED_TIMING.md) retains engine/evaluation safeguards
and dated history. The constraints in §13 identify integration risks, not completed work or test passes. §14 is the complete remaining plan; §15 records the approved decisions.
The committed baseline has no automatic-timing or detected-candidate interface.
References to preserving that capability mean reusing separately evaluated,
uncommitted work when implementation resumes. Individual Add to lyrics is an
approved requirement, not existing baseline functionality. No requirement is
satisfied by the prototype.

### Visual and interaction assets

The feature package includes an `assets/` directory, following the existing `features/lyrics-grouping/assets/` convention. Start with [`assets/README.md`](assets/README.md) for the intended use of each reference.

- [`assets/timing-workflow.html`](assets/timing-workflow.html) is a **self-contained interactive UX reference** with simulated states for an untimed project, per-occurrence review, an edited previously reviewed occurrence, timing settings, and regeneration. It does not run Whisper or play real audio.
- PNG screenshots in `assets/` provide stable, quick-to-inspect references for entry, review, changed/reset states and settings. [`workflow-header.png`](../workflow-navigation/assets/workflow-header.png) belongs to the separately scoped navigation feature.

**Behavioral decisions in this SPEC take precedence over illustrative assets.** Visual details (spacing, data, example model choices, lyric count, animation, typography, exact component structure) are not mandates. Reconcile the reference with the real app, existing accessibility and browser conventions; do not implement the prototype as a second application or copy its demo JSON format. Do not add a global Apply/Preview phase.

## 3. UX: entry, processing, results

### 3.1 New project without timings — default state

A **compact action area** near the existing player/timeline, not a large permanently expanded advanced form:

```text
TIMING                                                 0 / 73 reviewed

73 lyric occurrences · No timings assigned
Automatic timing can estimate where each line is sung.

Model                [Whisper medium              v]
Existing transcript  [Choose JSON…]  (optional)

[ Generate automatic timings ]
```

- **Keep model selection** visible. Show actually supported/cached models; use the existing backend rather than inventing different quality presets.
- **Keep optional existing Whisper transcript import** visible. Reuse the existing expected file format and error handling; do not silently treat arbitrary JSON as compatible.
- **Do not require first/last lyric range or audio start/end anchor inputs** in the ordinary setup UI. They may be useful for future targeted re-alignment, but they are not justified by the main new-project flow. Their presence in separate experimental work is not a reason to include them. If the algorithm truly requires internal bounds, derive them from the whole song/ordered occurrences or document the constraint and propose an unobtrusive alternative.
- Do not require prior transcription or translation review to generate timings unless the real implementation proves that dependency essential; report such a prerequisite explicitly.
- Display only genuine requirements: selected local media, ordered lyrics, ready model/transcript. Avoid fake processing-time estimates.
- Manual timing is always usable without pressing Generate.

### 3.2 While processing

```text
Automatic timing · Analyzing audio…
[ Progress, if actually available ]   [ Cancel, if cancellation is supported ]
```

Avoid invented percentages or estimates. If cancellation exists, terminate/ignore the job safely, not just hide the spinner. On failure, show an actionable error and preserve all existing timings/review state. Prefer one atomic commit of valid generated results to the project when the run succeeds; a canceled/failed run must not leave a half-applied dataset without a clear, intentionally supported partial-result flow.

### 3.3 After generation

- **Assign valid generated timestamps directly to current occurrence timings** (for occurrences the user has authorized the run to update); there is no separate global _Apply selected timings_ step.
- Changed/new generated timings are **Needs review**, not **Reviewed**. During explicitly authorized regeneration, an exact match to already reviewed current bounds retains Reviewed (§8). Display them as normal editable timeline blocks with a subtle unreviewed marker; the original algorithmic values remain available as reset references.
- Put results in the **existing sidebar, timeline, and inspector**. Do not duplicate them in a long “Detected from audio…” checklist at the top of the page.
- Collapse the generation area into a compact status/re-run control once timings exist. Present useful counts, e.g. `42 reviewed · 27 need review · 4 untimed` (illustrative).
- A **missing/unmatched lyric** is an existing occurrence for which the algorithm cannot produce a valid assignment; leave it untimed, report the count, and allow manual timing. Do not invent interpolated timestamps merely to eliminate an unmatched state.
- **Preserve the existing “Detected from audio” flow.** Additional transcript segments that do not match an imported occurrence may contain legitimate material (for example, a spoken introduction missing from published lyrics). Present these as **actionable candidates** with recognized text, approximate time range and a way to listen/inspect where already supported. A discoverable **Add to lyrics** action should create a new occurrence individually; do not quietly discard them as diagnostics or silently insert them into the project.
- When adding a detected candidate, preserve its audio position, allocate a stable occurrence ID, place it sensibly in the lyric sequence, and initialize its timing as **Needs review**. Preserve unrelated lyrics/translations/groups and avoid adding the _same candidate_ twice. Keep this operation undoable and persist it normally. Reuse the existing implementation instead of replacing it with speculative bulk transcript merging.
- Keep unmatched **imported occurrences** (no assigned audio interval) distinct from unmatched **audio-detected candidates** (possible extra occurrences). Both can occur in one run; they require different actions.
  A compact example for an unmatched **audio-detected** segment (not an unmatched imported lyric):

```text
Detected from audio · 1 possible extra segment

[ ▶ Listen ]  大家好            0:00.500–0:02.450
                                       [ + Add to lyrics ]
```

The recognized text/time should be inspectable before addition; the example is illustrative. Keep the approved individual-add capability in scope; reuse the evaluated candidate work without assuming a current baseline UI.

- Assigned generated boundaries **start** as Needs review, subject to the exact reviewed-match regeneration rule. Withheld weak estimates need the explicit per-occurrence action in §15 before they become current timings. Show existing reasons/counts unobtrusively; do not fabricate confidence metadata.

## 4. Per-occurrence review

### 4.1 Visible states

| State            | Meaning                                                                                                                                 | Interaction                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Untimed**      | No valid start/end interval                                                                                                             | Create timing manually; no review action yet.                   |
| **Needs review** | Timed, but the **current** values are not confirmed                                                                                     | Play, edit, then **Mark reviewed**.                             |
| **Reviewed**     | The current interval is accepted as the reset baseline, either by explicit confirmation or by migration of valid legacy/imported timing | Show confirmation; offer **Mark as needing review** if desired. |

“Automatic suggestion” is **not** an additional review status. It is a provenance/reset value. “Applied” should likewise not become a separate status. The distinction between _where a lyric is timed_ and _whether those timestamps were reviewed_ is fundamental.

### 4.2 Sidebar/timeline, without overcrowding

```text
Lyrics                                         12 / 73 reviewed

 ✓  做你的猫 喵喵                                Reviewed
 ✓  在你怀里睡着                                Reviewed
 ○  做你的猫 喵喵                                Needs review
 ○  印下梅花记号                                 Needs review
 –  向全世界宣告                                 Untimed

                                         [Select multiple]
```

- Review indicators are **status**, not ordinary selection checkboxes. Use readable text as well as symbols/color where practical.
- Timeline blocks can show a small check or status dot; **do not place full checkboxes on narrow timeline blocks**.
- In the selected-occurrence inspector, expose **Mark reviewed** and, once reviewed, **Mark as needing review**. A timed lyric can be reviewed even if overlap warnings are present, but its warnings remain visible; do not silently suppress them.
- Review is **per occurrence** (even when several occurrences share phrase text), including groups and duplicated/repeated passages.
- Default next-item navigation follows the currently displayed lyric order, respecting groups, while retaining selection by stable ID when timings reorder the sidebar.
- Keep the manually edited time fields, drag/trim, existing keyboard shortcuts, grouping behavior and Undo/Redo.

### 4.3 Auto-advance after review — configurable

**Setting:** `Advance to next unreviewed lyric after marking reviewed` (default **on**, approved).

The button itself should give a **subtle, legible hint** about what it will do; avoid a second toggle beside the button:

```text
Auto-advance ON:    [ ✓ Mark reviewed    → Next ]
Auto-advance OFF:   [ ✓ Mark reviewed ]
                    Stays on this lyric · Change in Timing settings
```

- When on, confirmation selects the next **timed, unreviewed** occurrence in displayed/grouped order and reveals it in the list and timeline. Search forward, then wrap to the beginning once; skip reviewed/untimed/invalid entries. Do **not** automatically start playback.
- When off, confirmation retains selection.
- If no eligible occurrence exists after one wrapped search, remain in the current context and show completion/remaining-untimed status without jumping unexpectedly.
- A review button is disabled for untimed/invalid intervals; do not allow a meaningless green check on a lyric with no timestamps.
- Persist this preference in the project JSON.

### 4.4 Secondary bulk review — included in this checkpoint

Provide a secondary **Select multiple** mode in the lyric sidebar (not always-visible checkboxes on timeline blocks). Selected timed occurrences can be marked reviewed or marked as needing review as one undoable action, with a clear count and an explicit confirmation before bulk approval. Untimed entries cannot be approved. Optional **Select all timed/unreviewed** is permitted, but bulk review is _not_ the default or required flow. Prevent accidental conflation of selection with review status.

## 5. Listen to a lyric — distinct from global playback

Preserve the existing player/spacebar behavior: selecting a lyric seeks to its beginning, and the global player remains normal timeline playback.

Add an explicit **Play lyric** button in the selected-occurrence inspector:

- Seek to `max(0, startMs - preRollMs)`, play at the current playback speed and stop at `min(mediaDuration, endMs + postRollMs)`.
- Repeating the button replays that segment from the beginning; a **Loop lyric** option repeats it until canceled.
- Respect a user's existing **Loop selected** feature if present; reconcile names/semantics rather than creating two conflicting loop modes. If there is one segmented-loop control, use it consistently for play-lyric and keyboard operation.
- Switching occurrence, starting ordinary global playback, navigating away or unloading media exits the bounded preview in an unsurprising way. Do not let an old segment's stop timer pause unrelated playback.
- If the occurrence is untimed, disable **Play lyric** with a concise explanation (the app has no interval to replay). **Do not disable normal playback**: the user can still use the existing global player, seek/waveform, and existing start/end capture keyboard shortcuts to establish timestamps manually. This sentence does **not** propose a second manual-timing control.
- Do not conflate auditioning with approving. Listening does not change review status.

**Settings:** configurable pre-roll and post-roll in milliseconds (approved defaults of 250 ms each, individually configurable from 0 to 5000 ms), persisted in the project JSON. Bound at media start/end. Do not hardcode a timing offset that permanently changes the actual stored boundaries.

Illustrative inspector:

```text
Lyric 3 / 73                                      Needs review
───────────────────────────────────────────────────────────
                         做你的猫 喵喵

Start (ms)  [19450]                     End (ms)  [22300]

[ ▶ Play lyric ]    [ Loop lyric ]

[ Reset to automatic timing ]

[ ✓ Mark reviewed   → Next ]
```

## 6. Reset semantics — initial generation vs reviewed baseline

**Do not add a prominent `Clear timing` action.** It has no compelling user story in this flow. Existing manual editing/Undo remain available, and regeneration can replace suggestions without clearing everything first. Re-evaluate only if a concrete later workflow needs it; do not design for speculative deletion.

### 6.1 Preserve distinct concepts

Per occurrence, distinguish:

1. **Current timing** — the editable start/end used by the app and exported to legacy TS.
2. **Latest automatic timing suggestion** — the model-generated interval, if any, retained for initial-review reset/provenance.
3. **Last reviewed timing snapshot** — the last accepted interval, from the user’s review or from migration of valid legacy/imported timestamps. This becomes the preferred stable reset baseline **after review**.
4. **Current review status** — whether the _current_ interval is accepted/reviewed. Editing it invalidates this status, while retaining the last-reviewed snapshot for restoration.

Use the existing occurrence IDs/project state; the following is **conceptual**, not a prescribed schema:

```ts
type Timing = { startMs: number; endMs: number };
type OccurrenceTimingMetadata = {
  automaticSuggestion?: Timing;
  lastReviewedTiming?: Timing;
  reviewed: boolean;
  // Optional: generation/run provenance, confidence and migration metadata.
};
```

The source of truth for **current** timing stays in the existing occurrence timing fields. Avoid storing an independent second current timestamp range.

**Do not introduce an extra import/pre-feature reset baseline.** If the current code has a historical `timingBaseline`/import snapshot, inspect and migrate it for compatibility, but it should not remain a competing reset target in the new workflow. On loading an older project without review metadata, convert each **valid, timed** occurrence to **Reviewed**, setting `lastReviewedTiming` to its _current_ timestamps; leave untimed/invalid occurrences unreviewed. This trusts the imported values as an established baseline without asserting that somebody personally listened to them. Ensure old JSON imports remain readable; any legacy fields retained for compatibility are not independent user-facing baselines.

### 6.2 Reset decision table

| Situation                                                               | `Reset timing` target                                  | Review effect                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| First generated suggestion, not yet reviewed, user has moved/trimmed it | **Automatic timing** generated for this occurrence     | Remains **Needs review**.                                                             |
| User confirms a corrected or unchanged suggestion                       | Current timing becomes **last reviewed** snapshot      | Becomes **Reviewed**.                                                                 |
| User subsequently edits a reviewed timing                               | No automatic change to snapshot                        | Current becomes **Needs review**; last-reviewed snapshot remains intact.              |
| User resets after a reviewed snapshot exists                            | **Last reviewed timing**                               | Restores confirmed values and **Reviewed** status (assuming exact restored interval). |
| Valid imported/legacy timing with no review metadata                    | Migrate **current** timing to **last reviewed timing** | Mark **Reviewed** during migration; no separate imported reset target.                |
| New manually timed occurrence with no automatic suggestion              | No reset target until reviewed                         | Manual timing can be marked reviewed to establish a baseline.                         |
| Generation supplies no timing for an occurrence                         | No automatic target                                    | Do not generate a fake interval.                                                      |

**Button label should reveal the actual target** rather than generically say “Reset timing”:

- During first-time review: **Reset to automatic timing**.
- After a reviewed snapshot exists and current time differs: **Reset to reviewed timing**.
- **Keep the reset control visible but disabled** when current timestamps already equal the chosen baseline. Its disabled text explicitly explains why: **Already at automatic timing** before any reviewed snapshot, or **Already at reviewed timing** when the last-reviewed snapshot is the reset target. Do not hide the button.
- Choose the target based on which baseline exists, **not** merely on the current review flag: editing a previously reviewed interval makes its current state Needs review but must not remove its reviewed reset target. If an occurrence has no baseline, show a disabled **No reset timing available** state. Identical timestamps alone must not silently change review status.
- If a later **explicit regeneration** produces a new suggestion for an occurrence with a prior reviewed snapshot, preserve the last-reviewed reset target; allow **Use latest automatic suggestion** through a secondary **Use latest automatic suggestion** action. It assigns that normal automatic interval as Needs review, retains the reviewed snapshot and is undoable. Weak estimates keep their separate explicit opt-in action. Never quietly replace the previously reviewed baseline.

Reset and review operations must be undoable, including restored review flags and snapshots.

### 6.3 Validation and review invalidation

- Any successful manual boundary change (typing, drag, keyboard, group move) to a reviewed occurrence marks **current values** as needing review; the last-reviewed snapshot is retained.
- Edits that do not actually change timestamps should not invalidate review.
- If a group movement affects several reviewed occurrences, invalidate review only for members whose current timestamps changed; preserve their review baselines and existing grouping semantics.
- A newly added/duplicated occurrence gets its own review state. Do **not** silently copy a reviewed flag from another occurrence merely because timestamps or text were copied; its status must reflect whether _this occurrence_ has been confirmed. Repeat/group duplication copies current timestamps but starts Needs review with neither automatic nor reviewed snapshots; no reset is available until that new occurrence establishes its own baseline.
- Review state changes must not alter phrase/translation review or segmentation approval.
- Validity is governed by existing timing rules; warnings such as overlap remain non-blocking, and review does not erase them.

## 7. Timing settings: compact gear popover and persistence

Move low-frequency controls behind a **Timing settings** gear in the timeline header. Keep the toolbar clean, but make the active values discoverable in a **small read-only summary**; clicking the summary or gear opens the same popover/dialog.

```text
Timeline                  8× zoom · Edge snap · Linked   [⚙ Settings]

┌ Timing settings ──────────────────────────────────────┐
│ Timeline                                               │
│ Zoom                      [8×           v]             │
│ Snap                      [Neighboring edges v]        │
│ Link touching edges       [ on/off ]                   │
│                                                        │
│ Lyric playback                                         │
│ Pre-roll                   [250] ms                     │
│ Post-roll                  [250] ms                     │
│                                                        │
│ Review                                                 │
│ Advance after marking reviewed [ on/off ]              │
└────────────────────────────────────────────────────────┘
```

- Keep actual functionality of existing zoom, snapping and linked edges; move **controls**, not behavior. Do not turn a read-only status into an unlabeled interaction.
- Popover must be keyboard-accessible, positioned within viewport, close with Esc, and not get clipped by scroll containers. No settings overlay should obscure a whole waveform while the user is reviewing.
- **Persist project-relevant editor preferences in project JSON**, including zoom, snap mode, link touching edges, pre/post-roll and auto-advance. Consider model choice a project preference where feasible. Migrate any historical `timingBaseline` safely without giving it a third reset meaning; respect existing audio metadata compatibility.
- Persist **settings**, not arbitrary scroll/hover/selection layout, unless already intentionally persisted. Do not store media bytes, transcript bytes, absolute paths or object URLs. A transcript file may need to be selected again after reload.
- Provide validated defaults when opening older JSON with no new fields. Do not silently reinterpret old data; use the approved metadata-aware migration while keeping the current file-version marker (§15).
- “Zoom 8× / Edge snap / Linked” is an **example**, not a demand to keep these exact values if a project has different settings.

## 8. Regeneration: protect reviewed work

The common workflow is a first run on an untimed song. A later automatic run may use a different cached model or transcript and must **not silently overwrite reviewed timings**.

### 8.1 Timing regeneration (in scope)

Provide **Regenerate timings…** as a secondary action after the initial run. Before committing any regenerated results, clarify the impact on current data. Approved modes:

1. **Update unreviewed/untimed occurrences only** (default). Preserve current timings and last-reviewed snapshots of all reviewed occurrences. New suggestions for eligible occurrences become Needs review.
2. **Replace all current timings with new suggestions** (explicitly destructive to edited/current timings; require confirmation and preserve recovery via Undo/project JSON). Do not delete lyric occurrences. Retain prior last-reviewed snapshots so the user can return to confirmed values.
   Persist pending detected candidates and weak estimates with stable IDs and minimal model/run/warning context. Associate them with a hash of the normalized audio used for transcription, plus its decoding parameters. On relink, matching audio allows normal reuse; different audio requires an explicit choice to reuse or regenerate. Until the hash is checked, do not claim a match. Loading another file never deletes candidates or alters current timings. A normal suggestion can replace current values only under the chosen run policy. A weak estimate needs a separate per-occurrence **Use estimate anyway** action after inspection; that action alone authorizes its assignment without another global Apply/permission step. Missing/weak-only output otherwise preserves existing current bounds and review status. An authorized regular suggestion identical to already reviewed current bounds keeps Reviewed; changed replacement values need review. Missing suggestions cannot justify removing previously reviewed timings. Preserve repeated occurrences' distinct IDs.

### 8.2 Separate future idea: bulk transcription/lyrics reconciliation (deferred)

**Timing regeneration** (8.1) changes timestamps on existing occurrence IDs. **Lyrics reconciliation** would change the occurrence list itself: wholesale replace, merge, or deduplicate newly transcribed content. These are related because they may use the same Whisper run, but they are not the same data operation or approval decision. Do **not** add a second complex merge wizard to this Timing feature.

Keep a short future-feature note for Codex: possible explicit operations include **replace existing lyrics** and **merge/remove only genuinely duplicate detections**. Repeated chorus lines are not duplicates merely because their text matches. Any destructive replacement needs its own specification and user approval.

**Exception — required behavior in scope now:** users must still be able to inspect and **individually add “Detected from audio” candidates** as described in §3.3. This is not the deferred bulk reconciliation feature.

## 9. Separately scoped workflow navigation

The top workflow header is specified in [Workflow navigation](../workflow-navigation/SPEC.md), with its [reference asset](../workflow-navigation/assets/workflow-header.png). It is proposed/unprioritized and requires separate plan approval. Timing implementation must preserve the current application shell and logical workspace switching; it does not depend on delivering navigation. The header visible in the Timing prototype is illustrative only.

## 10. Operational behavior and edge cases

- **No audio:** Tell the user to load a soundtrack; manual timing can continue, and no inference begins.
- **Audio replaced:** Detect when previous model suggestions may refer to another recording; prompt before reuse/regeneration. Retain current project data until the user explicitly decides otherwise.
- **Unmatched imported lyric:** Stay untimed, distinct from Needs review. Manual timing should remain possible. Wrong/broken imported lyrics, poor recognition, non-sung text, instrumental sections and long notes may all cause imperfect alignment; do not claim the cause without evidence.
- **Audio-detected extra segment:** Keep the existing add-to-lyrics action available; a missing spoken intro can be legitimate content, not an error. Adding one candidate creates a separate occurrence with its own Needs review state; nothing is auto-added or silently dropped.
- **No suggestions / poor suggestions:** Show meaningful counts, retain manual editing. The evaluation criteria in `ASSISTED_TIMING.md` still govern whether the algorithm materially helps; a tidy interface must not mask inaccurate results.
- **Invalid/malformed transcript:** Clear error; preserve current project. Existing transcript selection is optional and must not rewrite existing lyric content; explicitly adding a detected segment is a separate permitted action.
- **Existing fully/partially timed project:** Keep current timings. Initial generation should not silently overwrite them; route through the same explicit update policy as regeneration where necessary.
- **Repeat/duplicate/group:** New IDs and copied timing do not imply that a new occurrence was reviewed. Ensure group move invalidation, group status aggregation and chronological reordering remain correct. Audio-detected candidates should not be deduplicated by text alone.
- **Timing edits while generation runs:** Prevent stale results from overwriting subsequent user changes (disable conflicting action, use a project revision check, or handle merge explicitly). If inputs change materially, make results stale and require a new decision.
- **Autosave/reload/export:** Review status, reset snapshots, provenance where needed, and preferences survive project JSON round trip and browser recovery. Legacy TS contains only established timing data; no review/private metadata leaks into it.
- **Undo/redo:** Generation as one logical change, per-occurrence review changes, resets, edits, group movements and bulk approval restore coherent timing/review metadata. Do not flood history with individual autogenerated lines.
- **Accessibility:** All status indicators have text/accessible names and focus treatment; keyboard review/play/settings actions work without pointer-only interactions. Check narrow viewport layout.

## 11. Acceptance scenarios and tests

Use existing test infrastructure/dependencies, real project fixtures where suitable, and a stub/fake inference response where deterministic behavior is required. The 73-occurrence song in the screenshot is a useful **example**, not a hard-coded count.

- [ ] On a project with all timestamps null, Timing offers **Generate automatic timings** without first/last lyric or start/end anchor clutter; cached model selection and optional transcript remain.
- [ ] Generation success populates the **existing** timeline directly; normal generated assignments start as Needs review; weak-estimate opt-in is addressed in §15. No global Apply/Preview checklist is required.
- [ ] Generated timings, reviews, reset references, model/settings and audio metadata survive autosave, JSON export/reopen and browser reload (subject to relinking media).
- [ ] An untimed/unmatched imported occurrence is not approvable; it remains manually editable. An extra audio-detected spoken intro is shown with recognized content/timestamps and an easy individual **Add to lyrics** action. Nothing is added without the click; after adding it has a stable ID, preserved timing, Needs review status, and supports Undo/JSON round-trip; duplicate accidental addition is prevented.
- [ ] One occurrence can be auditioned with pre/post-roll and stop/loop behavior; global playback/spacebar behavior remains unchanged.
- [ ] A generated occurrence can be corrected, marked reviewed, and advanced to the next unreviewed one when enabled. Turning auto-advance off keeps selection. Button affordance reflects the setting.
- [ ] Review and bulk-review actions only change the intended occurrences and are undoable; grouping and repeated phrases keep independent statuses.
- [ ] **Before initial review**, Reset to automatic timing restores machine values while remaining Needs review. If values are already equal, the reset control is visible, disabled and labeled **Already at automatic timing**.
- [ ] **After review**, editing invalidates current review without losing the reviewed snapshot; Reset to reviewed timing restores reviewed values/status. If values already match the reviewed snapshot, the disabled control reads **Already at reviewed timing**. A later regeneration does not silently override that snapshot.
- [ ] Existing valid manual/imported legacy timings without new metadata migrate to **Reviewed** with their current values as the sole reviewed reset snapshot. Untimed occurrences stay unreviewed. Existing project JSON reads correctly, with no competing import/reset baseline.
- [ ] Existing zoom, snap and link-touching-edges interactions work unchanged behind a gear; active setting values are visible in a compact summary and persist in JSON.
- [ ] Regeneration offers only **update unreviewed/untimed** and **replace all current timings**, defaulting to preserve reviewed work. Explicit replace-all warns and supports undo; no run implicitly deletes lyrics or conflates repeated chorus occurrences with duplicates. No optional compare/apply wizard.
- [ ] Failed/canceled/stale inference does not partly corrupt project state or erase manually reviewed work.
- [x] Documentation reconciliation extracted the top workflow navigation into a **separate proposed feature spec** with its own assets, acceptance criteria and approval boundary. Navigation implementation and its UI tests belong to that separate feature, not the Timing feature's completion gate.
- [ ] Existing manual timing, grouped timeline movement, keyboard shortcuts, audio clock, export and format/regression checks still pass. Test on existing browser tooling; do not install browsers or dependencies without approval.

## 12. Codex handoff: reconcile → plan → implement → review

**Do not implement this document blindly.** First inspect `git status`, relevant current local files (including uncommitted automatic timing work), the docs above, JSON/schema and actual test scripts. In particular, identify what the committed Reset timing and undo logic do, and inspect separately available automatic-timing work before reusing its generation, candidate and progress handling. Do not infer behavior from screenshot labels.

Before changing code, deliver a **complete proposed implementation plan** that:

1. Summarizes the actual existing behavior and conflicts with this spec, including what is reusable.
2. Proposes the smallest coherent state/schema migration and reset/review invariants, including the distinction between original automatic suggestions and last-reviewed snapshots; no additional imported baseline. Preserve add-from-audio candidates and migrate valid legacy timed occurrences as Reviewed.
3. Lists UI changes and sensible **Timing-only** phases: (a) state/persistence, (b) compact generation flow and per-lyric review, (c) playback/settings, (d) regeneration; adjust order for dependencies. The separate [workflow-navigation draft](../workflow-navigation/SPEC.md) has been extracted as required by Section 9. Include navigation as a separately reviewable plan/workstream, not a mandatory Timing implementation phase.
4. Separates **current feature scope** (including required individual “Detected from audio” addition) from deferred bulk transcription/lyric replacement and algorithm experiments; reports any ambiguity that materially affects data safety.
5. Includes executable acceptance tests and realistic manual listening checks; specifies suggested review boundaries and any schema backward-compatibility concerns.
6. Identifies redundant/contradictory docs to update once implementation is verified, **without overwriting unrelated docs**.

**Writing the separate proposed navigation SPEC and organizing its design references are authorized documentation/reconciliation steps, not approval to implement application changes. Wait for the owner's approval of the plan(s) before implementing.** During approved implementation, use native task tracking when available and track the **entire** scope, not just a first slice. Prefer reviewable increments; report tests actually executed and any remaining steps at each boundary. **Present diffs for owner review and do not stage/commit without explicit approval.** Do not mark the feature done prematurely. No new software, system dependencies, browser downloads, model downloads or unrelated refactors without approval. Respect `AGENTS.md` and the repository's versioning convention.

After verified implementation and owner acceptance, update the living Timing/assisted-timing documentation and `ROADMAP.md` to reflect real behavior. Keep this spec as a useful behavior reference, not a contradictory second set of unverified claims.

## 13. Reconciliation constraints

The committed baseline supports manual timing. Automatic-timing implementation
work is separate and uncommitted; inspect it when resuming rather than assuming
the API, origin fields or new controls exist in the baseline. This specification
does not certify feature completion. Reuse evaluated work when available.

- Timing review belongs to each occurrence, independently of phrase-content review.
- Audit every timestamp mutation, including group moves and copies, when adding
  review invalidation and reset references.
- Preserve candidate discovery/insertion while replacing batch selection with the
  approved individual Add to lyrics flow. Keep weak-estimate opt-in distinct.
- Preserve the native playback clock, ordinary manual editing, waveform fallback,
  exact milliseconds, stable identities, undo/redo and legacy export.
- Introduce metadata-aware migration through all project ingress/persistence paths;
  do not treat existing reset snapshots as known automatic provenance.
- Navigation remains a [separate feature](../workflow-navigation/SPEC.md).

### Assets and operational boundaries

[Asset notes](assets/README.md) explain where the simulated references differ from
real controls. They do not establish implementation, model availability or release
version. Preserve the existing supported controls rather than copying demo values.

Use existing local dependencies and cached models; installation remains manual.
Retain bounded processing and cancellation. Media is sent only to the local
loopback process, with temporary inputs removed afterward; no external upload is
implied. Recognition counts do not certify timing accuracy, and ETA is approximate.
Keep source lyrics, media, weights and generated artifacts out of committed fixtures.

The [evaluation record](../../ASSISTED_TIMING.md) holds listening evidence and
accuracy safeguards. Application checks must be rerun during implementation rather
than copied from historical test totals.

## 14. Completion plan — documentation commit before implementation

This plan covers the **full remaining Timing scope**, not only its first increment.
Use existing dependencies/test infrastructure. Do not rewrite the algorithm,
waveform, main timeline, dictionary/editor or app shell. Internal review boundaries
below are suggested coherent increments, not declarations of checkpoint completion.
Owner decisions in §15 are approved. Application changes remain on hold until the separate documentation commit and checkpoint continuation; this preparation does not stage, commit or change application code.
Dependency order: A provides the common state/settings model; B/C/D build on it.
Implement E's update-policy and stale-result domain guards **with B**, before any
re-run is exposed, then finish E's regeneration UI/integration after C/D. E is not
a reason to ship an unsafe intermediate generation flow or a circular dependency.

### A. State, migration and timing-domain invariants

**Agreed state direction:** retain occurrence `startMs/endMs` as the only current interval.
Add occurrence timing metadata for explicit reviewed status, latest automatic
suggestion, last-reviewed interval, and minimal generation identity/reasons where
needed. Keep phrase content review and the existing detected origin flag independent.
A validated project timing-settings object holds zoom, snap, linked edges, model,
pre/post-roll and auto-advance. Do not persist media/transcript bytes or URLs.

**Approved migration (no version bump):** keep the current `schemaVersion: 1`
marker and add validated optional timing metadata/preferences through one shared
ingress used by browser recovery, JSON import and the local API. Absence of the
new occurrence review metadata identifies legacy input: valid current intervals
become Reviewed with their current values as reviewed snapshots, per §6. Explicit
new Needs review metadata must survive saves and never be remigrated as legacy
Reviewed merely because the marker remains 1. Null/partial/invalid intervals retain
their data and stay unreviewed. Consume/retire old `timingBaseline` on canonical
save; never guess that it is automatic provenance or preserve a third reset target.
Older strict readers may reject new optional fields; the unchanged marker does not
promise compatibility with old builds. Legacy TS format remains unchanged. No
new file-format or application-version bump is part of this decision.

Centralize timing-change/review/reset operations and route direct group shifts,
linked-edge edits, keyboard/capture/field edits and repeat/group copies through
consistent metadata rules. Only changed intervals lose review. Explicit mark-review
records current bounds; explicit un-review retains snapshots; manually returning
to equal values does not auto-review. Reviewed reset wins over automatic reset;
reset of reviewed bounds restores review explicitly. Preserve snapshot history.

**Acceptance/verification:** unit/migration tests cover mixed legacy data and old
baselines, repeated phrase independence, unchanged edits, all mutation paths,
copy initialization, overlap warnings, snapshot precedence and exact integer-ms
JSON/TS round trips. Verify parser/API/browser-store compatibility together.

**Boundary/dependency:** independently reviewable domain + migration foundation;
provide compatibility adapters until UI consumers move to the new contract.

### B. Compact generation, atomic assignment and detected candidates

Reuse worker/progress/result validation. Whole-song ordered occurrences/media
bounds replace ordinary range/anchor controls; keep range support internal only
if useful to existing tests, with no new advanced setup requirement. Discover
actually cached models rather than presenting hardcoded availability while keeping optional
transcript selection visible and its pre-audio selection/error protections.

On success, apply eligible **normal valid** generated timings as one project/history
change, record their automatic snapshots/reasons and set Needs review. Failures,
cancel or stale source/project revisions leave all data unchanged. Do not assign
weak spans by silently widening the accepted threshold; see §15. Missing results
never clear existing current timings. Preserve ordered IDs and group membership.

Remove global Preview/Apply and the long checkbox list only after replacing their
useful paths: candidate rows support inspect/listen and individual Add to lyrics,
with stable per-run candidate identity, duplicate-click protection, independent
Needs review state, origin flags and undo. Preserve exact shared-text reuse while
never deduplicating distinct occurrences merely because text matches. Approved
persistence: save compact outstanding candidate text/bounds/IDs/run references and
per-occurrence weak estimates in project JSON (no full transcript), so review can
resume after reopening. Hash normalized transcription audio, recording decoding
parameters; use a standard digest such as SHA-256 via existing/runtime libraries.
A matching audio hash permits reuse across renamed/repackaged files; audio
re-encoding can change the hash. A mismatch needs explicit reuse/regeneration; an
unverified hash is not a match. Do not turn this identity check into a transcription
cache or store raw audio/transcript data in the project. When a transcript is
uploaded independently, hashing the selected audio does not prove that this
transcript came from it. Preserve that provenance distinction and the matching-
input warning; never present an unverified external transcript/audio pair as
cryptographically authenticated.

**Acceptance/verification:** deterministic API/browser responses exercise initial
untimed generation, existing timed data, mixed unresolved/weak results, failures,
cancel/retry, edited/replaced inputs and repeated sections. Check atomic undo/reload,
no automatic lyric additions, two same-text/different-time candidates and duplicate
clicks. Raw imported source/order/group preservation must be asserted.

**Boundary/dependency:** depends on A and an authorized generation policy. Safe
regeneration rules from E must be in place before exposing re-runs on timed projects.

### C. Per-occurrence review in existing panels

Add status/counts to GroupSidebar/timeline/inspector and group aggregates without
reusing phrase review or crowding narrow blocks. Implement Mark reviewed / Mark as
needing review, contextual disabled reset labels, ID-based next-unreviewed selection
and a small auto-advance hint. Use displayed grouped order, not array positions
captured before a timing change. Do not start playback on review.

Implement the included secondary Select multiple mode in the sidebar, explicit
count/approval confirmation, bulk review/un-review as one history action, excluding
untimed/invalid intervals. Do not require bulk selection in ordinary review.

**Acceptance/verification:** repeated occurrences, moved/grouped items, edited
reviewed rows, no-op edits, reset equality with explicit un-review, untimed disable,
wrapped search, no remaining eligible row, bulk undo, focus/selection and autosave/reopen. Preserve shared
translation/segmentation state byte-for-byte where unaffected.

**Boundary/dependency:** A/B; use D's persisted auto-advance preference. No navigation
redesign is required.

### D. Bounded lyric replay and portable settings

Extend the existing native media clock with a bounded playback mode rather than a
second player or an independent drifting timeout. Play lyric uses configurable
pre/post-roll; one Loop lyric/selected control is reconciled for replay and existing
keyboard operation. Selecting elsewhere, global play, seek outside the segment,
media replacement or leaving Timing cancels bounded mode; old stop conditions
must not affect subsequent playback. Keep ordinary playback usable for untimed rows.

Move the baseline zoom/snap controls behind an accessible Timing settings gear
and clickable labeled summary. Integrate linked-edge controls from separately
available work after inspection. Preserve approved behavior and defaults; approved
new defaults are pre/post-roll 250 ms and auto-advance on. Persist settings from A;
respect reduced motion, viewport placement, Escape and focus return. Preserve baseline playback speed and integrate the planned translation toggle
without changing ordinary playback.

**Acceptance/verification:** real small WAV tests for clipped start/end, speed,
one-shot stopping, repeated replay/loop, cancellation/selection/navigation/media
changes, no audio/untimed rows, keyboard settings and narrow viewport. Assert that
padding never changes stored timestamps. JSON/preferences validation and old-data
defaults need unit/browser coverage.

**Boundary/dependency:** A; can be developed alongside B/C without changing shell
layout. Finish before declaring the review loop complete.

### E. Protected regeneration, final integration and checkpoint review

Offer preserve-reviewed/untimed+unreviewed mode by default; replace-all requires an
explicit impact confirmation. Retain last-reviewed snapshots in both modes and
store latest automatic values separately. Weak/missing results cannot erase current
reviewed times. Track eligible occurrence IDs and source/revision/model identity
at run start; stale results cannot overwrite later edits. Review invalidation follows
actual interval changes, with the explicit behavior for unchanged reviewed values
in §15. Include the secondary Use latest automatic suggestion action where reviewed
reset precedence hides the latest regular machine interval. The action sets Needs
review, preserves the reviewed target and is undoable. It never bypasses weak-estimate
opt-in or becomes a second global proposal editor.

Run all §11 scenarios and the cross-feature M2 regression gate, including browser
recovery/download/reimport, origins, groups, repeat/copy, weak overrides, cancellation,
real cached-model smoke and legacy TS export. Use synthetic committed fixtures;
real lyrics/media/model outputs stay ignored. No new installations without commands
for the owner. Record exact tests run and limitations; do not reuse old counts as
new passes. Manually assess perceptual timing with the owner.

**Suggested final reproduction:** import raw `public/做你的猫.txt` in Import lyrics;
load `public/做你的猫 [rEV1VWwwAyA].mp4` in Timing; generate using the existing matching
Whisper JSON for a fast repeatable run, then verify a cached-model run separately.
Under the **target** flow normal assignments appear directly as Needs review;
listen/correct/mark each occurrence, add selected intro candidates individually,
reset before/after review, regenerate with reviewed protection, undo and reload JSON.
The old explicit Apply walkthrough is not the target acceptance test.

**Boundary:** final owner review of the whole approved scope, exact diff/validation
summary and a fresh commit proposal. Do not stage/commit automatically. Stage
explicitly scoped paths only after approval; the deleted checkpoint file's old
mixed-code staging script is obsolete. First commit the reconciled documentation
separately after its own approval; later domain/UI commits may follow the above
coherent boundaries, but a slice review is not checkpoint completion.

### Separate workstream: workflow navigation

[Workflow navigation](../workflow-navigation/SPEC.md) has its own proposed scope,
acceptance criteria and later approval boundary. No implementation phase above
moves the main navigation or changes routes. Coordination is limited to shared
header/viewport/inert constraints documented there.

## 15. Approved decisions

The owner resolved these individually after reconciliation. These decisions govern
the remaining implementation; they are **not claims of implemented behavior**.
Application changes remain outside this documentation-only preparation.

1. **Migration without a version bump.** Keep the existing file-version marker.
   Files lacking new timing-review metadata migrate valid current intervals to
   Reviewed/current-value reset snapshots. This intentionally includes saved old
   automatic drafts, which legacy data cannot distinguish. New explicit review
   metadata prevents repeated migration. Retire the competing old baseline.
2. **Weak estimates stay opt-in.** Normal valid assignments populate the timeline
   directly as Needs review. Weak estimates remain inspectable/listenable in the
   occurrence inspector until Use estimate anyway assigns that row immediately,
   without global Apply. Regeneration leaves existing bounds/status unchanged
   unless this per-row choice is made; absent/invalid/long-gap spans stay unresolved.
3. **Persist pending review information and audio identity.** Save outstanding
   detected passages, unchosen weak estimates, stable IDs and minimal model/run/
   warning context. Hash the normalized audio used for transcription, with decoding
   parameters; do not rely on filenames. Matching audio permits reuse; different
   audio requires explicit reuse/regeneration. Unknown/unchecked identity is not
   called a match. Replacing media never deletes candidates or current timings.
   Store neither media bytes, full transcripts nor model weights. This is not the
   separately deferred content-hash transcription cache.
4. **Auto-advance wraps.** Default on, configurable and project-persisted. Search
   displayed/grouped order forward, then wrap once to the first eligible timed
   unreviewed occurrence. Skip reviewed/untimed/invalid rows; stay put when none
   remain and report untimed work separately. Do not auto-start playback.
5. **Copies are independent.** Repeat/group duplication keeps copied current bounds
   but starts Needs review without inheriting automatic or reviewed reset snapshots.
   Reset stays unavailable until that occurrence's own review/generation establishes
   a reference. Preserve source occurrence and shared translations. Group-aware
   missing-chorus suggestions are deferred until import improvements mature; do not
   replace current individual candidate additions with an unapproved group engine.
6. **Bulk review is included.** Secondary sidebar Select multiple mode, timed/valid
   rows only for approval, clear count and explicit bulk-approval confirmation.
   Mark reviewed/unreviewed as one undoable operation. No timeline checkboxes and
   no bulk-selection requirement in the ordinary single-occurrence workflow.
7. **Regeneration exact matches preserve review.** Preserve-reviewed is the default
   run policy. If replacement is explicitly allowed, a regular proposal equal to
   already reviewed current bounds keeps Reviewed; changed bounds need review and
   preserve the last-reviewed target. No regular result means no replacement.
   Replace-all authorizes regular proposals across the run; Use estimate anyway is
   a separate per-occurrence choice for a weak result, not an additional permission
   that must be combined with replace-all. Both retain the reviewed reset snapshot.
8. **Replay padding.** Default 250 ms before/after, each configurable from 0–5000 ms
   and saved in project settings. Clamp playback to media bounds. Padding never
   modifies current timestamps; global playback semantics stay unchanged.
9. **Latest automatic action is included.** Where a reviewed baseline exists, Reset
   targets that baseline. Also offer secondary Use latest automatic suggestion to
   assign the latest regular automatic interval as Needs review, retaining reviewed
   reset and undo. Weak estimates remain separately gated.

Implementation details such as field names, hash encoding/decoding parameters,
accessible settings positioning and test organization should follow these rules
and existing conventions; material changes to the agreed behavior need owner review.
The navigation proposal remains separately scoped and unprioritized.
