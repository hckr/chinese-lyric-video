# Remotion consolidation — audit-first refactor

## Reality check / baseline first

The repository contains at least two user-described video families: **music-video footage** and **still image plus audio visualizer**, plus **multiple thumbnail compositions**. The previous roadmap also names compositions `LyricVideo`, `LyricVideo2`, `LyricVideoShort`, `LyricVideoOnlyPinin`, `Thumbnail`, `Thumbnail2`, `ThumbnailOnlyPinyin`, but Codex must verify actual current files/IDs and uncommitted changes before acting. Do not infer that similarly named files are duplicates. The current GitHub repo could not be fully re-audited from this session.

Codex must build a **composition inventory** with, for every registered composition: source file, ID, dimensions, FPS, duration calculation, aspect ratio, audio source, background type, lyric variant, watermark/outro, thumbnail behavior, special per-song differences, and asset dependencies. Group common behavior by reading call sites, not merely by looking for repeated JSX.

## Recommended layered shape (proposal, not forced folder names)

```text
src/
  remotion/
    compositions/       # registered video + thumbnail entrypoints
    scenes/             # shared lyric sequence and outro
    lyrics/             # word rows, translation blocks, timing selectors
    backgrounds/        # video | image + visualizer | optional others
    visualizers/        # bars/waves, audio-data helpers
    thumbnails/         # reusable typography/layout; separate composition wrappers
    design/             # fonts, typography, responsive layouts, presets
    config/             # typed defaults + preset resolution
  songs/                # optional future song registry / adapters (not first refactor)
```

Prefer a **shared `LyricVideoScene`** (text placement, timed phrase selection, synchronized layout/animation, watermark/outro) and **background strategy** (`VideoBackground` vs `ImageVisualizerBackground`) over a single mega-component that assumes all modes are the same. A background mode controls audio ownership explicitly: one soundtrack; in `music-video` mode, use source video's embedded audio *or* a separate audio file as configured, never both by accident. In image mode the soundtrack is separate.

Thumbnails should be **separate compositions** that reuse text/typography, logo, color treatments and media processing helpers as appropriate. Don't force them to support timeline or audio. The fact that two videos share a few layers is not sufficient reason to merge their composition APIs wholesale.

## How to decide what to extract

**Extract** when a part is behaviorally the same across actual use sites: lyric active-line selection; Pinyin, gloss, EN/PL placement; text shadows; CJK font loading; shared overlays; background transforms; visualizer primitives; watermark; outro. Extract pure calculation helpers first.

**Keep variant-specific** when behavior genuinely differs: foreground footage vs image and visualizer, variant-only overlays, outro exceptions, thumbnail framing, aspect-ratio-specific framing. Avoid incidental abstractions based only on coincidentally identical markup.

**Do not over-configure** every CSS property. Provide a typed, meaningful surface for values a creator changes between songs; keep algorithm and frame-level implementation details internal.

## Prop / configuration classification

| Setting | Recommendation | Where it belongs |
|---|---|---|
| Song lyrics / timed occurrences | Required data | Song adapter / composition input |
| Mode: music video or image + visualizer | Discriminated variant, no ambiguous booleans | `background.kind` |
| Video/image/audio asset reference | Required by chosen mode | `media` and background settings |
| Visualizer enable/style, 1–2 colors, opacity, intensity | User-configurable with defaults | `visualizer` group |
| Background blur/dim, scale/fit/crop | User-configurable, range-clamped | Background group |
| Text size/spacing, text visibility options, palette | Named preset + sparse overrides | Typography/lyric group |
| Aspect ratio / full vs pinyin-only / short | Named output variant (or wrapper composition) | Composition registration and variant props |
| Watermark text/visibility, outro enabled | User-configurable in limited safe form | Overlay/outro group |
| FPS, dimensions, timebase semantics | **Preserve existing defaults**; don't expose indiscriminately | Registration/render policy |
| Animation easing, internal frame offsets, FFT bin math | Implementation detail until demonstrated need | Component internals |
| Thumbnail-specific hierarchy/crop/title position | Thumbnail preset | Thumbnail composition only |

**Presets** should preserve each existing output's look. Initially implement **`legacy-video`**, **`legacy-image-visualizer`**, and any actual thumbnail variants found. Build a UI for choosing presets + small overrides rather than a giant panel of dozens of controls. For a new setting, the default must match the old appearance at baseline configuration. This is not a mandate to standardize colors across existing videos.

## Migration sequence

1. Inventory and capture **reference frames** from representative songs, positions (intro, active line, repetition, long line, outro) and thumbnails. Note original composition IDs and commands.
2. Introduce typed config/presets, **without changing visuals**; adapt old compositions through thin compatibility wrappers. Register current IDs unchanged.
3. Extract *pure* timing/text/layout helpers and shared lyric rendering. Validate all variants.
4. Extract background strategies independently: music-video video footage; image + audio visualizer. Check cropping, blur, transformations, waveform responsiveness and audio routing.
5. Consolidate shared overlays/outro, then thumbnails using leaf components; don't share state that makes thumbnails dependent on playback.
6. Only then optionally add song registry and integrate workbench settings through an adapter. Do not change composition IDs or remove legacy entrypoints until explicitly approved.

## How the React UI consumes this

The Video settings screen edits `VisualConfig`, not arbitrary React component internals. An adapter turns that into Remotion props. First it can show a **style-only mock preview**. When ready, use an actual Remotion Player **importing the shared composition**, with the identical config resolution used for final rendering. Avoid building a separate video renderer in the frontend. Keep the Remotion render entrypoints usable directly even if the workbench doesn't run.

Audio spectrum computation can be expensive. Reuse the existing Remotion implementation; distinguish live browser preview from precomputed render audio data when necessary. Ensure previews and exports reflect the same final prop values.

## Tests before declaring success

- Existing composition IDs, dimensions, FPS, durations and variants remain registered.
- Reference frames show visually equivalent output (reasonable deterministic tolerances for effects/fonts). If an intended styling change is made, document it explicitly.
- Song with **footage** plays exactly one soundtrack, retains video framing, and shows correct lyrics.
- Song with **image + visualizer** retains original visualization and colors when no override supplied. Changing visualizer color in config affects preview AND render.
- Full, pinyin-only, short, 16:9, 9:16 and every existing thumbnail variant remain accessible where previously supported.
- Composition parameters should be testable as plain data without needing to render video.
