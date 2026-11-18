# Automatic Timing & Review — design assets

These are **conceptual design references**, not production components or a second specification. Read `../SPEC.md` first; when behavior differs, **the SPEC wins**.

## Main reference

- [`timing-workflow.html`](timing-workflow.html) — dependency-free interactive concept. Open in a browser. Use the **Example states** controls at the top to switch between an untimed project, generated timings awaiting review, and a previously reviewed lyric whose timing was subsequently changed.

The prototype demonstrates the following interactions with simulated data:

1. Generate example timings directly into the existing timeline. There is **no global preview/apply phase**.
2. Select one lyric, edit start/end milliseconds, **Mark reviewed**, and optionally auto-advance. Review is per **occurrence**, including repeated lyric text.
3. Before first approval, **Reset to automatic timing**. Following approval, editing invalidates review; **Reset to reviewed timing** restores the accepted baseline and reviewed status. When already at the target, the reset control stays visible and disabled with an explanatory label.
4. Enter the **Timing settings** gear popover: zoom, snap, linked edges, replay pre/post-roll, and auto-advance. The read-only timeline summary remains visible.
5. Inspect a **Detected from audio** spoken-intro candidate and **Add to lyrics** individually. This creates a separate occurrence marked Needs review; the approved individual Add to lyrics capability remains in scope.
6. Use **Select multiple** for explicit bulk review, or **Regenerate timings…** for the preserve-reviewed vs. replace-current decision.
7. Inspect the top workflow navigation as a **cross-feature visual sketch**, not an approved Timing requirement. Its requirements are now in [the separate navigation spec](../../workflow-navigation/SPEC.md).

The **Download project JSON** control exports an _illustrative prototype object_, not the real project's schema.

## Static snapshots

| Asset                                                                       | Intended reference                                                                                                                              |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `timing-before-generation.png`                                              | Compact initial action with cached-model and optional-transcript inputs; empty lyric timing.                                                    |
| `timing-review.png`                                                         | Generated timings used immediately by the existing timeline; per-occurrence Needs review status and an actionable extra spoken-intro candidate. |
| `timing-detected-added.png`                                                 | Example extra segment added from audio as an occurrence, timed but awaiting review.                                                             |
| `timing-post-review.png`                                                    | Mixed Reviewed/Needs review states, changed timing, and reset to last reviewed baseline.                                                        |
| `timing-settings.png`                                                       | Gear popover with timeline, bounded playback, and review preferences.                                                                           |
| `timing-regeneration.png`                                                   | Timing regeneration choices and explicit protection of reviewed work.                                                                           |
| [workflow-header.png](../../workflow-navigation/assets/workflow-header.png) | Relocated cross-feature navigation reference; owned by the separate navigation proposal.                                                        |

## Boundaries and non-requirements

- **No real Whisper processing or playback.** The audio waveform, elapsed time, Chinese lyrics, model choices and generated timings are examples. No backend, API, filesystem, audio analysis, or storage is used, except the browser file picker and the optional local demo JSON download.
- Screenshots include a top **UX REFERENCE** control strip. This is a testing aid, **not part of the application UI**.
- In the production editor, retain its actual waveform implementation, dragging/trim behavior, grouping, shortcuts, timing precision, undo/redo, schema and media controls. The HTML is not an implementation shortcut.
- The appearance is directional: dark surfaces, compact hierarchy, independent review status, inspectable settings, and legible progress. Exact fonts, spacing, icons, numbers, generated Chinese text and component markup are **not mandatory**.
- Header completion badges must reflect actual project state, not hard-coded visits. The prototype's Import ✓ is illustrative; Video/Export remain mapped to the existing routes. **App-wide navigation is specified separately and requires its own approval** per Section 9 of the Timing SPEC.
- The visual assets **deliberately exclude** earlier drafts showing lyrics already timed in the supposedly untimed state, global Apply/Preview suggestion checklists, speculative range/anchor inputs, or prominent Clear timing controls.
- **Bulk** replacing or deduplicating lyric occurrences after transcription is deferred and should not be confused with timing regeneration. The approved **individual Add to lyrics** capability for audio-detected segments remains in scope.
- Valid timed legacy imports may be initialized as Reviewed and their current values used as the reviewed reset baseline; the prototype does not demonstrate schema migration.

## Reconciliation notes (2026-11-18)

All six Timing PNG states and the HTML source were inspected; the assets remain
unchanged. They are not evidence of app behavior. In particular:

- The before-generation screenshot shows a lyric in the playback preview despite
  untimed occurrences. Production playback cannot infer an active lyric without
  timestamps. Retain the committed selected-lyric inspector; the planned playback
  preview must be time-based rather than copied from this simulated state.
- The prototype has eight example rows, version v0.3.0, a `large` model option,
  linked edges enabled, and limited zoom options. These are illustrative, not
  claims about the committed version or model availability. Preserve actual
  supported controls and the approved defaults when implementing the feature.
- Prototype auto-advance wraps to the first remaining row, matching the subsequently
  approved wrapped search. Preserve real displayed/grouped order and search once;
  do not copy demo index-based identity handling.
- Prototype regeneration clears an unmatched current interval in its “all” mode;
  production must preserve existing values when no valid new interval exists.
- Prototype play/loop and model selection are simulated; settings, focus and
  migration need real implementation/tests. Its sample JSON is not a schema.
- Workflow-header screenshot was moved byte-for-byte to the navigation feature.
  The HTML's conceptual header remains a cross-reference, not Timing scope.
