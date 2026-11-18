> Reconciliation (2026-11-18): this reference describes the existing workspace organization. [Automatic Timing & Review](features/automatic-timing-review/SPEC.md) owns the proposed Timing changes; [Workflow navigation](features/workflow-navigation/SPEC.md) separately proposes a later top header. Neither proposal is already implemented, and Timing does not authorize shell navigation changes.

# UI specification — dark React workbench, five workspaces

The included HTML is an **interactive visual reference** with sample phrases, simulated timings, a synthetic waveform and illustrative video settings. It does **not** implement secure TS AST parsing, Python AI, actual media-backed audio analysis or Remotion rendering. Production requirements are defined in the other documents.

## Current implementation and authority

Source inspected on 2026-11-14: import, lyric review, local dictionary and manual timing/grouping are implemented. Video settings is a placeholder directing users to the existing Remotion workflow; there is no actual Player or settings adapter. The screens below combine implemented requirements and explicitly future design. Assets communicate visual intent, not proof of pixel fidelity.

This reference owns shared visual/product choices. [Segmentation](WORD_SEGMENTATION.md), [timing](TIMING_EDITOR.md), [grouping](features/lyrics-grouping/SPEC.md) and [import proposals](features/lyrics-import-enhancements/SPEC.md) own feature interactions; [ROADMAP](../ROADMAP.md) owns scheduling.

## Visual language

The accent sampled from the supplied button screenshot is **`#4EAEF8`**. Dark mode on **every** screen; avoid white input panels.

| Token              | Value     | Role                               |
| ------------------ | --------- | ---------------------------------- |
| `--accent`         | `#4EAEF8` | Primary action / focus / selection |
| `--page`           | `#0C1119` | App background                     |
| `--nav`            | `#090E16` | Navigation                         |
| `--surface`        | `#171E29` | Primary card                       |
| `--surface-raised` | `#1D2734` | Elevated control                   |
| `--field`          | `#101925` | Editable inputs                    |
| `--border`         | `#2D394A` | Dividers                           |
| `--ink`            | `#EAF3FD` | High-contrast text                 |
| `--muted`          | `#9DAEC2` | Secondary text                     |
| `--ok`             | `#70D2B4` | Completed/reviewed                 |
| `--warning`        | `#E8AF68` | Missing timing / overlap           |

Primary blue controls use **dark** label text. Maintain readable Hanzi and tone-mark glyphs with local CJK font fallbacks; do not download extra fonts. Keep visible focus rings and real label associations.

## Navigation

Left sidebar: **Import lyrics · Lyric editor · Timing · Video settings · Export data**. These are product areas, not necessarily consecutive mandatory steps. Header can show a workflow navigator and validation status. Timing should be independently accessible even before translations are complete.

## Screens

### 1 — Import

Raw Chinese lyrics via paste or `.txt` import, plus existing TS song import. Title/artist. Retain repeated occurrences while deduplicating shared phrases; show data/timing warnings. Replacement protection and live structure preview remain proposals in the import feature specification. Existing sample TS contains declarations and reusable arrays; parse statically and reject unsupported syntax rather than executing code.

### 2 — Lyric editor

Three columns: searchable unique phrase list; EN/PL translation and word-token breakdown; dictionary/preview inspector. Edit Pinyin and English gloss, add empty-Hanzi contextual notes, reorder tokens, **merge two adjacent word tokens**, **split a multi-character token at a chosen Hanzi boundary**, mark reviewed, and invalidate review status after changes. The editor must show explicit Split / Merge controls and an editable preview/confirmation for each operation; see `WORD_SEGMENTATION.md`. Phrases are shared across repeated occurrences. Pinyin rules are owned by [WORD_SEGMENTATION.md](WORD_SEGMENTATION.md).

### 3 — Timing

See `TIMING_EDITOR.md` for binding logic. Recommended layout: top playback controls + file picker, left occurrence list (not phrases), central waveform/timeline, right timing inspector with exact millisecond fields and jump to translation. Blue playhead, amber pending/overlap cues, loop and zoom controls. Should work for timed imported `.ts` and raw unassigned lyrics.

### 4 — Video settings (proposed)

Choose background **music video** or **image + audio visualizer**. Show only relevant fields: music-video fit/dim/blur and audio routing, or image crop/motion + visualizer color/style/opacity/intensity. Support named legacy presets, lyric visibility/size, ratio, watermark and minimal thumbnail presets. Show a preview with a clear **layout-only** label until actual Remotion Player is integrated. Do not expose every CSS constant.

### 5 — Export

Show validation: phrase mappings, missing translations, _unassigned/invalid_ occurrence timings, missing media, configuration incompatibilities and missing original assets. Download legacy `.ts` (manual copy to `src/`) and separately a **versioned project JSON** for workbench state. Occurrence timings are exported through legacy `TIMELINE`; review state, groups and audio metadata are project-only. Visual presets are not implemented. Conflicting duplicate lyric text blocks TS export; JSON drafts remain saveable.

## Layout / implementation

- Respect the system’s reduced-motion preference for animated scrolling and transitions.
- Keyboard shortcuts must leave text entry unaffected.
- Desktop: sidebar + main workspace, with independently scrolling editor/lists where useful. Timing timeline should claim the central width; a resizable/collapsible inspector remains an optional proposal.
- Narrow: stack/collapse panels; timeline horizontally scrollable, with accessible form controls. Avoid tiny drag targets for handles on touch.
- Keep state mutations in testable pure domain functions; React components should not directly rewrite imported TypeScript source strings.
- Persist reviewed statuses in project JSON; imported song TS remains an input/output compatibility format.

## Why the prototype isn't sufficient as code

HTML controls are meant to communicate hierarchy and interaction affordances. The reference uses synthetic waveform data and mock video frames. Agent must implement actual occurrence data, waveform extraction, audio source selection, export validity, safe importer and Remotion integration according to the [active roadmap](../ROADMAP.md).

## Accepted review choices

These supersede contradictory prototype or early checkpoint details:

- Focusing any word field selects its token. One Add word action creates an empty row; empty-Hanzi notes remain editable.
- Gloss fields grow to three lines and then scroll. Sentence fields remain single-line at 16px. The accepted preview uses 26px Hanzi, 16px Pinyin/translations and an 11px caption. The desktop inspector is 360px with responsive layout protection.
- Phrase subtitles/search include English and Polish. Review validation has padding and separation from the review action; disclosure arrows rotate without shifting labels. Spacing errors have one actionable warning with explicit Fix spacing.
- Dictionary lookup is on demand, with CC-CEDICT/MDBG attribution and Pinyin hover/focus bubbles. Editable gloss and dictionary senses remain distinct. Model-inferred contextual sense/provenance is future C work.
- Wiktionary uses the actual page in an in-app iframe dialog, resolves a unique Chinese soft redirect on demand and retains a separate-page link. Its loading badge overlays reserved space without shifting layout.
- Timing and grouping use the accepted B interaction rules in their feature references. B's owner acceptance on 2026-11-14 does not certify touch operation or perceptual synchronization. Optional inspector resizing and timeline overview are undelivered proposals, not reasons to reopen B.

The dark theme, blue accent color and these review choices are accepted; pixel-for-pixel mockup fidelity has not been certified. Use [TEST_PLAN](TEST_PLAN.md) for remaining checks and known issues, and [web/README](../../web/README.md) for operation/tooling.
