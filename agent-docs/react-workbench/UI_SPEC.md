# UI specification — dark React workbench, five workspaces

The included HTML is an **interactive visual reference** with sample phrases, simulated timings, a synthetic waveform and illustrative video settings. It does **not** implement secure TS AST parsing, Python AI, actual media-backed audio analysis or Remotion rendering. Production requirements are defined in the other documents.

## Visual language

The accent sampled from the supplied button screenshot is **`#4EAEF8`**. Dark mode on **every** screen; avoid white input panels.

| Token | Value | Role |
|---|---|---|
| `--accent` | `#4EAEF8` | Primary action / focus / selection |
| `--page` | `#0C1119` | App background |
| `--nav` | `#090E16` | Navigation |
| `--surface` | `#171E29` | Primary card |
| `--surface-raised` | `#1D2734` | Elevated control |
| `--field` | `#101925` | Editable inputs |
| `--border` | `#2D394A` | Dividers |
| `--ink` | `#EAF3FD` | High-contrast text |
| `--muted` | `#9DAEC2` | Secondary text |
| `--ok` | `#70D2B4` | Completed/reviewed |
| `--warning` | `#E8AF68` | Missing timing / overlap |

Primary blue controls use **dark** label text. Maintain readable Hanzi and tone-mark glyphs with local CJK font fallbacks; do not download extra fonts. Keep visible focus rings and real label associations.

## Navigation

Left sidebar: **Lyric editor · Import lyrics · Timing · Video settings · Export data**. These are product areas, not necessarily consecutive mandatory steps. Header can show a workflow navigator and validation status. Timing should be independently accessible even before translations are complete.

## Screens

### 1 — Import

Raw Chinese lyrics via paste or `.txt` import, plus existing TS song import. Title/artist. Show original line count, deduplicated unique phrases, unassigned times, data warnings, repeated chorus occurrences retained. Existing sample TS contains declarations and reusable arrays; parse statically and reject unsupported syntax rather than executing code.

### 2 — Translate and review

Three columns: searchable unique phrase list; EN/PL translation and word-token breakdown; dictionary/preview inspector. Edit Pinyin and English gloss, add empty-Hanzi contextual notes, reorder tokens, **merge two adjacent word tokens**, **split a multi-character token at a chosen Hanzi boundary**, mark reviewed, and invalidate review status after changes. The editor must show explicit Split / Merge controls and an editable preview/confirmation for each operation; see `WORD_SEGMENTATION.md`. Phrases are shared across repeated occurrences. **Pinyin is contiguous within one word token** (`漂亮` → `piàoliang`, not `piào liang`); full lyric Pinyin joins distinct word tokens with spaces. Validate imported, AI-generated, and exported token readings, without silently changing existing manual data.

### 3 — Timing

See `TIMING_EDITOR.md` for binding logic. Recommended layout: top transport + file picker, left occurrence list (not phrases), central waveform/timeline, right timing inspector with exact millisecond fields and jump to translation. Blue playhead, amber pending/overlap cues, optional loop/zoom, clear keyboard-shortcut cheat sheet. Should work for timed imported `.ts` and raw unassigned lyrics.

### 4 — Video settings

Choose background **music video** or **image + audio visualizer**. Show only relevant fields: music-video fit/dim/blur and audio routing, or image crop/motion + visualizer color/style/opacity/intensity. Support named legacy presets, lyric visibility/size, ratio, watermark and minimal thumbnail presets. Show a preview with a clear **layout-only** label until actual Remotion Player is integrated. Do not expose every CSS constant.

### 5 — Export

Show validation: phrase mappings, missing translations, *unassigned/invalid* occurrence timings, missing media, configuration incompatibilities and missing original assets. Download legacy `.ts` (manual copy to `src/`) and separately a **versioned project JSON** for workbench state. Timing and presets are not automatically stored in legacy `LYRICS_DICT` unless adapter compatibility is established.

## Layout / implementation

- Desktop: sidebar + main workspace, with independently scrolling editor/lists where useful. Timing timeline should claim the central width; allow resizable or collapsible inspector.
- Narrow: stack/collapse panels; timeline horizontally scrollable and keyboard-editable. Avoid tiny drag targets for handles on touch.
- Keep state mutations in testable pure domain functions; React components should not directly rewrite imported TypeScript source strings.
- Persist reviewed statuses in project JSON; imported song TS remains an input/output compatibility format.

## Why the prototype isn't sufficient as code

HTML controls are meant to communicate hierarchy and interaction affordances. The reference uses synthetic waveform data and mock video frames. Codex must implement actual occurrence data, waveform extraction, audio source selection, export validity, safe importer and Remotion integration in the milestones specified by `CODEX_TASK.md`.
