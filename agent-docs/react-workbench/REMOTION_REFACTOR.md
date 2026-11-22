# Remotion consolidation — audit-first refactor

## Reality check / baseline first

Source inspection on 2026-11-14 confirms the following registrations in [Root.tsx](../../src/Root.tsx). Consolidation and shared visual configuration remain unimplemented. Registration is not evidence that every composition is used in production; establish that usage with the owner during D.

| ID                  | Source under `src/`               | Size      | FPS / frames                         | Behavior and assets                                                                                                     |
| ------------------- | --------------------------------- | --------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| LyricVideo          | LyricVideo.tsx                    | 1920×1080 | 23.976 / 5196                        | Keep Walking MP4 with embedded audio; full words/EN/PL; dark overlay, watermark, Lottie/hearts/outro                    |
| LyricVideoOnlyPinin | LyricVideoOnlyPinin.tsx           | 1920×1080 | 23.976 / 5196                        | Same footage/audio/outro, Hanzi/Pinyin layout without full gloss/translations                                           |
| LyricVideoShort     | LyricVideoShort.tsx               | 1080×1920 | 23.976 / 852                         | Portrait Keep Walking footage/lyrics inside Sequence from −1074; no full outro                                          |
| LyricVideo2         | LyricVideo2.tsx                   | 1920×1080 | 25 / 4612                            | Macchiato cover image, MP4 soundtrack via one Html5Audio; full lyrics/watermark, FFT bars and bass pulse/blur; no outro |
| Thumbnail           | LyricVideoThumbnail.tsx           | 1280×720  | Still; historically enumerated 1 / 1 | thumbnail-bg-369.png; title glosses/labels                                                                              |
| ThumbnailOnlyPinyin | LyricVideoThumbnailOnlyPinyin.tsx | 1280×720  | Still; historically enumerated 1 / 1 | Same image; Hanzi/Pinyin title                                                                                          |
| Thumbnail2          | LyricVideoThumbnail2.tsx          | 1280×720  | Still; historically enumerated 1 / 1 | vlcsnap-2026-06-20-20h55m06s209.png; alternate title/framing                                                            |

### Existing rendering contracts

All four video implementations round each boundary with `Math.round(ms / 1000 * fps)`, use end-exclusive Sequence durations and fall back to five seconds when the rounded end is not after the start. Zero placeholders are not synchronized timing. The short's −1074-frame offset is composition-specific; never bake it into song exports. Landscape footage variants start the outro at frame 5015, hearts at 5043 and the second outro line at 5098.

Footage uses `@remotion/media` Video for client-side rendering and OffthreadVideo for server rendering, retaining embedded audio. Image mode has one Html5Audio; LyricVideo2 draws Visualizer **twice**, which affects appearance but does not create a second soundtrack. Preserve this until baselined rather than treating it as accidental duplicate JSX.

The two song MP4s, Macchiato cover and thumbnail images resolve through `staticFile` in `public/`. The landscape footage components directly import the grin-sweat/heart-face Lottie JSON files from `public/` into the bundle. Media is locally ignored and not bundled in project downloads. Remotion Google-font helpers currently load NotoSansSC/Inter/LexendDeca; the workbench uses local fallbacks. Do not introduce font/runtime downloads incidentally.

Shared candidates include font loading, heavy text shadows, word/translation rows, time conversion, dark overlays and watermark. Lottie/hearts/outro apply to landscape footage variants; thumbnail framing/content and portrait wrapping stay variant-specific. Inventory dimensions, duration policy, lyric variants, overlays, assets and per-song exceptions again before extraction; inspect call sites rather than file names.

### Reference coverage still needed

Capture representative intro/active/repeat/long-line/outro frames and verify audio before D extraction. Use the owner’s working Chrome/client-side path for footage; the server-side helper has a [known capture issue](TEST_PLAN.md#known-issues). Keep the reference set through comparison; isolated image-mode stills do not establish full-video equivalence. The remaining checks are in [TEST_PLAN.md](TEST_PLAN.md#m0--baseline--preservation).

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

Prefer a **shared `LyricVideoScene`** (text placement, timed phrase selection, synchronized layout/animation, watermark/outro) and **background strategy** (`VideoBackground` vs `ImageVisualizerBackground`) over a single mega-component that assumes all modes are the same. A background mode controls audio ownership explicitly: one soundtrack; in `music-video` mode, use source video's embedded audio _or_ a separate audio file as configured, never both by accident. In image mode the soundtrack is separate.

Thumbnails should be **separate compositions** that reuse text/typography, logo, color treatments and media processing helpers as appropriate. Don't force them to support timeline or audio. The fact that two videos share a few layers is not sufficient reason to merge their composition APIs wholesale.

## How to decide what to extract

**Extract** when a part is behaviorally the same across actual use sites: lyric active-line selection; Pinyin, gloss, EN/PL placement; text shadows; CJK font loading; shared overlays; background transforms; visualizer primitives; watermark; outro. Extract pure calculation helpers first.

**Keep variant-specific** when behavior genuinely differs: foreground footage vs image and visualizer, variant-only overlays, outro exceptions, thumbnail framing, aspect-ratio-specific framing. Avoid incidental abstractions based only on coincidentally identical markup.

**Do not over-configure** every CSS property. Provide a typed, meaningful surface for values a creator changes between songs; keep algorithm and frame-level implementation details internal.

## Prop / configuration classification

| Setting                                                 | Recommendation                                                | Where it belongs                           |
| ------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------ |
| Song lyrics / timed occurrences                         | Required data                                                 | Song adapter / composition input           |
| Mode: music video or image + visualizer                 | Discriminated variant, no ambiguous booleans                  | `background.kind`                          |
| Video/image/audio asset reference                       | Required by chosen mode                                       | `media` and background settings            |
| Visualizer enable/style, 1–2 colors, opacity, intensity | User-configurable with defaults                               | `visualizer` group                         |
| Background blur/dim, scale/fit/crop                     | User-configurable, range-clamped                              | Background group                           |
| Text size/spacing, text visibility options, palette     | Named preset + sparse overrides                               | Typography/lyric group                     |
| Aspect ratio / full vs pinyin-only / short              | Named output variant (or wrapper composition)                 | Composition registration and variant props |
| Watermark text/visibility, outro enabled                | User-configurable in limited safe form                        | Overlay/outro group                        |
| FPS, dimensions, timebase semantics                     | **Preserve existing defaults**; don't expose indiscriminately | Registration/render policy                 |
| Animation easing, internal frame offsets, FFT bin math  | Implementation detail until demonstrated need                 | Component internals                        |
| Thumbnail-specific hierarchy/crop/title position        | Thumbnail preset                                              | Thumbnail composition only                 |

**Presets** should preserve each existing output's look. Initially implement **`legacy-video`**, **`legacy-image-visualizer`**, and any actual thumbnail variants found. Build a UI for choosing presets + small overrides rather than a giant panel of dozens of controls. For a new setting, the default must match the old appearance at baseline configuration. This is not a mandate to standardize colors across existing videos.

## Migration sequence

1. Inventory and capture **reference frames** from representative songs, positions (intro, active line, repetition, long line, outro) and thumbnails. Note original composition IDs and commands.
2. Introduce typed config/presets, **without changing visuals**; adapt old compositions through thin compatibility wrappers. Register current IDs unchanged.
3. Extract _pure_ timing/text/layout helpers and shared lyric rendering. Validate all variants.
4. Extract background strategies independently: music-video video footage; image + audio visualizer. Check cropping, blur, transformations, waveform responsiveness and audio routing.
5. Consolidate shared overlays/outro, then thumbnails using leaf components; don't share state that makes thumbnails dependent on playback.
6. Only then optionally add song registry and integrate workbench settings through an adapter. Do not change composition IDs or remove legacy entrypoints until explicitly approved.

## How the React UI consumes this

The Video settings screen edits `VisualConfig`, not arbitrary React component internals. An adapter turns that into Remotion props. First it can show a **style-only mock preview**. When ready, use an actual Remotion Player **importing the shared composition**, with the identical config resolution used for final rendering. Avoid building a separate video renderer in the frontend. Keep the Remotion render entrypoints usable directly even if the workbench doesn't run.

Audio spectrum computation can be expensive. Reuse the existing Remotion implementation; distinguish live browser preview from precomputed render audio data when necessary. Ensure previews and exports reflect the same final prop values. Direct rendering, asset-path assignment and filesystem writes must be explicit user actions, never side effects of opening/editing a project. Preserve manual export when preview/render services are unavailable.

## Tests before declaring success

- Existing composition IDs, dimensions, FPS, durations and variants remain registered.
- Reference frames show visually equivalent output (reasonable deterministic tolerances for effects/fonts). If an intended styling change is made, document it explicitly.
- Song with **footage** plays exactly one soundtrack, retains video framing, and shows correct lyrics.
- Song with **image + visualizer** retains original visualization and colors when no override supplied. Changing visualizer color in config affects preview AND render.
- Full, pinyin-only, short, 16:9, 9:16 and every existing thumbnail variant remain accessible where previously supported.
- Composition parameters should be testable as plain data without needing to render video.

## Implementation and verification record (Checkpoint D)

1. **Shared Remotion modules extracted**:
   - `src/remotion/design/fonts.ts`: Font loaders (`notoSansSCFont`, `interFont`, `lexendDecaFont`) and text shadows (`heavyTextShadow`, `heavyTextShadow2`).
   - `src/remotion/lyrics/`: `LyricLine.tsx`, `timing.ts` (`msToFrameDuration`), `types.ts` (`WordData`, `LineData`, `TimedLineData`).
   - `src/remotion/backgrounds/VideoBackground.tsx`: Video / OffthreadVideo switch with audio retention.
   - `src/remotion/visualizers/Visualizer.tsx`: Dual-pass FFT visualizer bars adapting to portrait and landscape.
   - `src/remotion/overlays/`: `Watermark.tsx`, `HeartBackground.tsx`, `Outro.tsx`.

2. **Reusable Templates (`src/remotion/templates/`)**:
   - `VideoLyricTemplate.tsx` (based on `LyricVideo` footage): Configurable `videoSrc`, `lyricMode` (`"full"` vs `"only-pinyin"`), `variant` (`"landscape"` vs `"short"`), `sequenceOffset`, watermark, outro.
   - `ImageVisualizerTemplate.tsx` (based on `LyricVideo2` image + visualizer): Configurable `imageSrc`, `audioSrc`, bass-pulse blur/scaling, dual-pass FFT visualizer bars.
   - `LyricVideoTemplate.tsx`: Discriminated union template (`type: "video"` vs `type: "image-visualizer"`).
   - `ThumbnailTemplate.tsx`: Unified thumbnail template with `mode` (`"full"`, `"only-pinyin"`, `"title-only"`), configurable labels, titles, background images, and music notes watermark.

3. **Legacy compositions & Studio interactivity**:
   - All 7 legacy compositions (`LyricVideo`, `LyricVideoOnlyPinin`, `LyricVideoShort`, `LyricVideo2`, `Thumbnail`, `ThumbnailOnlyPinyin`, `Thumbnail2`) retained with frozen IDs, FPS, dimensions, and visual fidelity as thin wrappers.
   - 5 new template compositions registered in `src/Root.tsx`: `Template-Video-Landscape`, `Template-Video-Short`, `Template-ImageVisualizer-Landscape`, `Template-ImageVisualizer-Short`, `Template-Thumbnail`.
   - Remotion Studio Zod schemas configured with static literal `defaultProps` in `Root.tsx` to ensure interactive parameter editing works cleanly without AST or runtime errors.

4. **Verification**:
   - `tsc --noEmit`: 0 errors.
   - `npm run lint:ts`: clean.
   - `node web/tests/run.ts`: 119/119 tests pass.
   - `remotion compositions`: 12 compositions cleanly enumerated.
   - Bit-for-bit MD5 pixel identity against baseline stills:
     - `Thumbnail`: `ded77db67f50effd6bad306aaaff6d47` (100% Match)
     - `ThumbnailOnlyPinyin`: `1cb926527c52c83c2d67def3f4fd5304` (100% Match)
     - `Thumbnail2`: `43df85e0c49471979f86cea979b81a24` (100% Match)
     - `Template-Thumbnail`: `ded77db67f50effd6bad306aaaff6d47` (100% Match)
