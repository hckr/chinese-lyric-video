# Import lyrics — structured editor and review UX

This document describes the Import editor in 0.4.0. The [implementation record](SPEC.md) covers verification and deferred work.

## 1. Editor and review model

The lyrics document is the editable source for text, line boundaries and section headings. A synchronized, read-only outline shows the resulting structure. AI suggestions remain pending until accepted. Optional audio comparison presents missing passages for review and insertion.

**Agreed product decisions**

- Original lyrics are assumed to contain **no square-bracketed text**; `[Section name]` can unambiguously mean a section heading. No escaping language is needed.
- Pasted lyric occurrences are already in the **correct relative order**. Do not build lyric/section reordering UI. The sole addition to this sequence is a **user-approved insertion** of a missing passage discovered from audio.
- The read-only structure preview navigates to the corresponding lyric in the editor.
- New lyric lines containing Hanzi must satisfy the 11-element limit before import.
- The contextual dictionary supports optional word and pronunciation review.

## 2. Overall workflow

1. **Source:** paste lyrics or load `.txt`, optionally provide title, artist, and audio. Local parsing and diagnostics update immediately; no AI request is made by typing.
2. **Edit manually:** type or remove `[Section]` headings, insert/remove newlines, and fix diagnostics directly in the editor. This is available without any AI provider.
3. **Review with AI (optional):** request structural suggestions. Proposed headings and line breaks appear _in context_, without modifying the text until accepted. AI failure preserves manual editing.
4. **Compare audio (optional):** transcribe/compare, inspect discrepancies, and approve insertions of missing passages into the source document. Review and assign timing for discovered passages where necessary.
5. **Import:** validate the _actual accepted editor document_, create the usual ordered occurrences/groups and transfer linked audio/metadata. Do not commit invalid new lines.

These are **views/activities within Import**, not new global navigation steps or a forced sequential wizard. The user may return to the source editor without losing the draft, approved edits, or cached analysis.

## 3. Source screen layout

Keep the established dark workbench visual language, top navigation, title/artist/audio inputs, project-open/replace safeguards and saved-project loader. Reorganize the source area:

```text
Import lyrics

Title [                          ]  Artist [                      ]

LYRICS EDITOR                                  STRUCTURE PREVIEW
┌────────────────────────────────────────┐     ┌─────────────────────────┐
│ 1  [Verse 1]                           │     │ ▼ Verse 1 · 4 lines     │
│ 2  做你的猫 喵喵                         │     │ ▼ Chorus · 3 lines     │
│ 3  在你怀里睡着                          │     │ ▶ Verse 2 · 8 lines    │
│ 4  做你的猫 喵喵                         │     │   1 issue              │
│ 5  印下梅花记号                          │     │ ▶ Chorus · 3 lines     │
│ 6                                      │     │                         │
│ 7  [Chorus]                             │     │ 18 occurrences         │
│ 8  向全世界宣告                          │     │ 4 sections · 1 issue    │
│ 9  你的重要                              │     └─────────────────────────┘
│ 10 贪恋你一丝一毫                        │
└────────────────────────────────────────┘

Audio (optional) [Choose file] song.mp4 [Remove]

[Review with AI]  [Compare with audio]  AI: Groq · selected model [⚙]

[Problems: 1] [Suggestions: 0]          [Import without AI review →]
```

This is a conceptual interaction sketch, **not** a pixel-perfect visual requirement. Use actual project data and existing controls. The source editor should receive most horizontal space (roughly two-thirds on desktop); the preview gets the remainder. The editor should have a usable bounded height, line numbers and its own expected editor scrolling—**not** an accumulating chain of expanded result forms with nested scroll containers. On narrow screens (test at 390px), stack editor and a collapsible preview; retain accessible diagnostics and actions.

- Present a compact summary even for plain, unmarked lyrics; do not invent section names.
- Keep model/provider settings in a compact anchored popover (or existing settings pattern), rather than a tall expanding form. Display the selected provider/model near the AI button.
- Display the selected audio file and make audio comparison discoverable only when audio is present. The source editor remains usable when comparison is not run.
- Do not send pasted text to any remote provider until the user explicitly requests an AI/audio action.

## 4. Text syntax and parsing contract

- A line consisting solely of optional whitespace, `[`, a **nonempty section name**, `]`, and optional whitespace is a **section heading**. Preserve the displayed name (case and spelling). The heading itself is not a lyric occurrence and does not count toward the 11-element limit.
- A blank line, the next heading, or an explicit `[/]` terminator ends the preceding section. After a terminator, lyrics remain ungrouped until another heading. A stray terminator is a diagnostic. When reconstructing a document, omit terminators when the next heading already closes the section. Repeated `[Chorus]` headings create **separate section instances**, even with identical text. Every repeated lyric line remains a separate occurrence; reuse the existing shared-phrase/translation-identity behavior.
- Every other nonempty source line is **one lyric occurrence** in the order typed. **Do not silently create extra occurrences by splitting on punctuation** or by running AI. A newline explicitly separates occurrences; AI-generated line-break suggestions must be accepted first.
- Blank or whitespace-only lines close any open section and create no occurrences. Lyrics before the first heading are ungrouped. Blank-line stanzas may inform _suggestions_ but are not silently assigned a named group.
- A user-entered heading may designate a **one-line section** (e.g. `[Spoken intro]`). No empty groups: an empty heading/section is diagnosed and must be corrected before new import.
- A malformed heading (e.g. empty `[]` or unmatched bracket) gets a clear parser diagnostic, never a silently invented group. Because square brackets are reserved, there is no bracket-escaping feature.
- Preserve lyric characters, punctuation, spacing and order. Do not quietly trim/rewrite textual content, strip credits, infer alternate lyrics, or normalize the visible editor document. Character counting may operate on a normalized copy; source text remains as entered.
- `.txt` opens in this editor, using precisely the same parser and diagnostics as paste. Existing saved JSON/legacy TypeScript projects use the existing load paths, not the raw-text parser.

### Group-model compatibility

Use the existing stable group and occurrence representation in the created project; no parallel serialized group model. The existing Timing **+ Group** interaction may require at least two members, but an **explicit section heading in Import is allowed to contain one lyric**. Reconcile that creation-path distinction without breaking existing grouping/timing behavior. Ungrouped occurrences must remain genuine ungrouped occurrences, not a synthetic persisted group.

## 5. Live diagnostics: the 11-element rule

Apply the **same centralized validator** to pasted text, `.txt`, AI split results, and proposed audio insertions:

- On lines containing Hanzi, count each Hanzi, each Latin word (including internal apostrophes) and each digit once. The limit is 11 elements. English-only lines are exempt and remain independently timed sung lyrics.
- Valid lines (0–11 counted characters) are not visually noisy. A line with **12+** gets a visible inline error, a `count / 11` indicator, a gutter marker, and navigation from the summary/preview.
- Highlight the excess portion of the line in a way that follows the _counted_ characters rather than its raw string offset; do not imply that punctuation consumes the allowance.
- Clicking/keyboard-activating a diagnostic shows: the current count, a concise explanation, and **Fix manually** / **Show suggested split** if a safe proposal exists. The error remains until the actual line becomes valid, even if a suggestion is dismissed.
- Suggested splits prefer punctuation, natural phrase boundaries and available lexical boundaries, but **preserve every original character in order**. Show the exact resulting lines and their individual counts. Support three or more pieces. Users can edit freely rather than being forced to accept an algorithmic split.
- Do not automatically wrap or hard-split at the 11th character; visual wrapping is not a lyric boundary. The user must insert a newline or accept an explicit patch.
- Revalidate immediately after typing, pasting, joining, splitting, applying an AI suggestion, or inserting audio text. Keep the cursor/selection and undo/redo behavior usable during diagnostics.

Example (counts are illustrative of these exact strings):

```text
 7  我想告诉你一个很长很长的故事    14 / 11  [error]

    Suggested line break:
    + 我想告诉你一个              7 / 11
    + 很长很长的故事              7 / 11
    [Accept split] [Dismiss]
```

The example's leading `+` indicates a **preview of new document lines**, not characters inserted in the lyric. Errors **block successful new import**, but not ongoing editing or independent audio/AI review. Do not disable the entire editor because of a violation. Existing/legacy projects with previously saved long lines must still load intact; surface violations without silently splitting them or destroying saved translations/timings. Distinguish that compatibility case from validating _newly created or changed_ occurrences.

## 6. AI suggestion UX (in the same editor)

**One editor, not separate manual and AI full-song lists.** Manual review is the default act of editing the document; an existing **Review manually** button may be removed or reduced to focusing the editor. **Review with AI** adds proposals in that same editor, never a second full-song form.

### Proposal types

1. **Insert/rename a section heading** — show a provisional `[Chorus]` (or other label) at the proposed boundary.
2. **Split/join lyric lines** — show the exact proposed newline changes, previewing the resulting lines and 11-element counts; do not combine nonadjacent lines.
3. **Change lyric characters** — _not_ a default structural operation. If the existing AI backend produces a textual correction, show an explicit before/after diff and require a separate deliberate acceptance; never quietly replace the user's lyrics.

### Display and interaction

- Mark affected source lines with small gutter indicators and unobtrusive inline decorations. A focused suggestion expands into a concise **before → after** patch with **Accept** / **Dismiss**. Avoid rendering 70+ always-expanded suggestion cards.
- A small header summary (`4 suggestions · 2 issues`) supports **Next/previous suggestion** and **Next/previous issue**. Keyboard focus and click-to-jump reveal the relevant line without losing context.
- **Accept** applies one editor transaction containing only that proposal's text changes; the preview and diagnostics update immediately. **Dismiss** leaves the document unchanged and hides that proposal until the next explicit analysis. All changes participate in ordinary undo/redo.
- Accepted text is ordinary editor text. Reversing it with undo should not leave orphaned section/group metadata.
- Existing manual headings and manual lyric boundaries take precedence over AI proposals. The AI may propose alternatives but cannot silently rewrite them.
- An incoming response is associated with the source snapshot it analyzed. If the user edits relevant lines meanwhile, mark affected proposals **outdated** and prevent blind application. Unaffected proposals may survive only when anchored reliably to unchanged text/ranges; otherwise request explicit reanalysis. Never attach a proposal to the wrong repeated chorus.
- Do not call the model on each keystroke. Run analysis only on a user action; report running/error/complete state near the action. Retain usable local editing if the provider is unavailable, fails, or rate-limits.
- Preview reflects **only accepted source text**, never unaccepted AI ghost headings or splits. This avoids conflicting representations of the pending import.
- No global **Accept all** is required in this redesign; per-suggestion acceptance is the baseline. If batching is later introduced, it must detect conflicts and avoid text edits without explicit review.

## 7. Read-only structure preview

Derived from the **current parsed editor text**, not maintained as a second independently editable draft.

- Show ordered headings/sections with names, lyric occurrence counts and aggregated diagnostic counts. Show ungrouped lines in a neutral ungrouped region, without creating a persisted group.
- Collapsible section summaries may reveal constituent lines. Clicking a heading or line **navigates/focuses that position in the editor**. Clicking an issue navigates to the offending text. The active section can be highlighted.
- **No preview editing controls**: no renaming, drag/reorder, boundary ranges, group deletion or moving lines. All such changes happen by editing the document text.
- Repeated headings (e.g. two choruses) remain visibly separate; clicking either must locate the correct instance.
- The preview updates locally and promptly after each editor change; there is no network dependency or manual refresh button.
- Avoid preview rendering every occurrence by default for long songs. Collapsible, summary-first presentation is sufficient.

## 8. Audio comparison and missing lyrics

Audio comparison remains a **focused optional Import view**, not another accordion nested below a 70-line structure list. Reuse existing transcription services, regeneration options, timestamp handling and audio state.

- Summarize **matched**, **uncertain**, **unmatched pasted lines**, and **audio-only passages** separately. Show actionable discrepancies first; matched results are collapsed by default. Avoid a full-height numbered report of all successful matches.
- Detected audio-only passages can be listened to, dismissed, or reviewed. A valid passage can be added. A passage exceeding 11 elements opens a focused split editor **before insertion**, with full source passage, proposed text pieces, audio playback, and readable start/end times.
- Where Whisper word timestamps support a chosen break, preserve the actual word boundary times and any gap. Where data is absent or a break falls inside one token, request manual timestamp correction. Never evenly divide a passage's duration as a substitute for evidence.
- **Propose an insertion point** before/between/after existing lyric occurrences based on alignment. Show a local text diff with surrounding headings/lines; require explicit confirmation. If placement is uncertain, let the user choose an insertion point **without reordering any existing lyric**.
- On acceptance, insert the approved text (and any optional `[Spoken intro]` heading) into the **same editor document**, then update the preview. Preserve candidate provenance, reviewed timestamp intervals and needs-timing-review state in draft metadata associated with those inserted occurrences. These metadata do not require timestamp markup inside the editor.
- Add reviewed split pieces as one undoable operation and consume the candidate; undo restores the candidate. Cancel leaves it pending. The lyrics editor and audio comparison must never become two conflicting sources of lyric order.
- A new audio passage may be inserted into an existing section; do not force it to create a section. No other automatic or manual _reordering_ feature is requested.

## 9. Project state, persistence and safe editing

- The source document is the authoritative **draft** for lyric text, line boundaries and headings. Its parsed structure is derived. Timing, reviewed flags, audio, translations, AI-suggestion state and provenance are **separate metadata**, not a text markup language.
- Draft state survives switching among Import's source/editor and audio comparison activities. Do not rerun AI/Whisper merely on navigation. Invalidate only analysis whose inputs materially changed.
- Keep project cancels replacement and preserves the current project, history and linked audio. Confirming **Discard project and start import** immediately clears the project, history, audio and recovery copy. A failed import keeps the replacement draft available for correction. Project creation from that draft is atomic.
- When an existing project is opened for **Edit song structure**, reconstruct/display the headings and ordered occurrences while preserving IDs, content, timestamps, translations, review statuses, and audio for unchanged occurrences. Heading-only edits change section membership, not occurrence identity. The user must be able to cancel without applying a draft.
- Source-to-occurrence matching must account for repeated identical phrases; _text alone_ is not a stable occurrence ID. Avoid regenerating occurrence IDs on every editor keystroke.
- For an already timed occurrence, an edit that would create/delete/split/merge its occurrence identity must not silently discard or guess timing/translation metadata. If a safe reconciliation flow is not already supported, explicitly restrict that edit in existing-project mode, explaining why; keep heading/membership edits functional. Handling _new_ Whisper discoveries is separate and happens before those pieces become committed occurrences.
- Existing project JSON remains backward-compatible; do not require new evidence fields for old projects. `Edit song structure` should be one undoable commit when applied, preserving selection and paused playhead on return to Timing.

## 10. Scope

The editor uses the shared document parser and native text editing controls. Local dictionary lookup, provider suggestions, and transcription follow the paths described in [the implementation record](SPEC.md). The Import workflow keeps pasted source text, including credits, available for manual correction. YouTube acquisition and changes to lyric order for existing projects remain outside this checkpoint.

## 11. Acceptance and regression checks

### Parsing and editor

- [ ] Paste and `.txt` load produce identical ordered occurrences; `[Verse 1]` and repeated `[Chorus]` produce distinct, ordered section instances.
- [ ] A single lyric line under an explicit heading is supported; ungrouped text remains ungrouped. Empty/malformed headings show actionable diagnostics.
- [ ] No implicit punctuation splitting, lyric rewriting, or reordering; preview/import agree on the exact accepted lines.
- [ ] With no headings or AI provider, manual editing and import still work.
- [ ] Structure preview is read-only, collapsible and click-to-navigate; repeated identical choruses navigate to the correct instance.

### Length validation

- [ ] Mixed lyrics at 10, 11, and 12 elements are validated consistently. English-only lyrics are exempt.
- [ ] NFC composed/decomposed accents give the same count; no visual mutation of the original text.
- [ ] Long lines needing **three or more** pieces can be split manually or via a reviewed suggestion; joining two lines revalidates them.
- [ ] No new import pathway—including raw shortcut, AI acceptance or audio insertion—can bypass the 11-element limit.
- [ ] Legacy saved projects containing longer occurrences still open without losing any old data.

### AI review

- [ ] Proposed headings/splits do **not** affect actual text or preview until individually accepted.
- [ ] Accept/dismiss work; accepted edits undo/redo cleanly. Dismissal never clears a real length error.
- [ ] Editing a proposed location makes its stale suggestion non-applicable rather than patching the wrong repeated line.
- [ ] No provider, model failure, HTTP 429 and user cancellation leave editing functional and source text intact.
- [ ] The song does not expand into separate 70-line manual and AI review forms.

### Audio and persistence

- [ ] Audio-only detection proposes an insertion with context; user approves location and the resulting text appears in the main editor in the correct place.
- [ ] Overlong audio-only passages require split review with valid timing; manual timestamp correction works when word evidence is missing; gaps are preserved when known.
- [ ] Approved multi-piece insertion/undo is atomic, and draft metadata survives source/audio view changes.
- [ ] Canceling the replacement gate preserves the prior project/history/audio. Confirmation discards them. Failed import preserves the replacement draft; successful import transfers linked audio and section IDs.
- [ ] Existing-project heading-only edit preserves lyric IDs, translations, timings and selection after apply, save and reopen.

### Visual/accessibility verification

- [ ] Capture and inspect screenshots for initial paste, a 12+-character error, an expanded split suggestion, a proposed `[Chorus]` heading, accepted suggestions, and a reviewed audio-only insertion.
- [ ] Test realistic long lyrics (~70–75 occurrences) at desktop and 390px widths: diagnostics and AI suggestions remain navigable without giant expanding lists or clipped actions.
- [ ] Verify keyboard and screen-reader access for preview navigation, diagnostics, suggestion acceptance/dismissal, cancellation and focus restoration.
