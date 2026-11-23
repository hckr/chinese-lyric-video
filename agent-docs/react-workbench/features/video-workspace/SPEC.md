# Video workspace — visual designs, output variants, and thumbnails

**Area:** React workbench → Video and Export; Remotion template adapters  
**Status:** Implemented for review. The verification record below distinguishes exercised paths and remaining environment limits.  
**Location in repository:** `agent-docs/react-workbench/features/video-workspace/SPEC.md`  
**Related:** `agent-docs/react-workbench/REMOTION_REFACTOR.md`, `ARCHITECTURE.md`, `TEST_PLAN.md`, `agent-docs/ROADMAP.md`, existing project/domain schemas, and Import/Timing media handling.

> **Implementation baseline:** The owner reports a newer local Remotion refactor with `VideoLyricTemplate.tsx`, `ImageVisualizerTemplate.tsx`, a discriminated `LyricVideoTemplate.tsx` wrapper, and `ThumbnailTemplate.tsx`. That refactor may not yet be on the public `master` branch. Inspect the working tree, actual prop types, composition registrations, current Video/Export workspaces, and Git state before planning changes. Local source takes precedence over this document's illustrative names. Keep legacy song compositions and direct Remotion Studio usage working.

## 1. Goal and decisions

Build a Video workspace for _designing and previewing_ a song's lyric videos and thumbnails, and an Export workspace for _selecting and rendering_ multiple outputs from the same project. Avoid a form per composition or duplicating the entire song for each variant.

The author's real workflow:

1. Attach a music file during Import/Timing. It is often an MP4 chosen primarily for its **audio**, sometimes containing a useful music video, and sometimes merely a still image embedded in a video.
2. Reuse that recording as the song's master soundtrack and, optionally, as the **original video background**.
3. Alternatively replace the visual background with a **still image** or a **short looping video**, with optional visualizer effects. Looping must include ping-pong (forward → backward → forward…).
4. Create multiple lyric-video outputs from the **same lyrics and timing**, normally: landscape **with Pinyin**, landscape **without Pinyin**, and a **portrait short with Pinyin**.
5. Produce those output variants for one or more visual designs (e.g. original footage and image+visualizer) and optionally export thumbnails.

**Decisions:**

- Keep global navigation `Import → Translations → Timing → Video → Export`; do **not** restore the old left sidebar or add a second step-progress bar inside Video.
- Inside Video use `Video` and `Thumbnail` tabs. Export remains a separate workspace.
- Separate **song soundtrack**, **visual background**, **visual design**, and **output variant** in both UI and data model.
- Preview with the _actual Remotion rendering components_, not a separate CSS-only imitation. Preview and final render use the same resolved configuration.
- Preserve old composition IDs, visual defaults, and direct Remotion Studio entry points via compatibility adapters. An intentional new variant is additive; don't silently alter a legacy variant.
- Retain existing built-in output aesthetics as presets; don't expose every low-level component prop.
- Do not require all output variants to be rendered. The user chooses a batch in Export.

## 2. Terminology and relationships

| Concept               | Meaning                                                                                  | Ownership                                        |
| --------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Song media**        | Source file attached during Import/Timing (audio-only or video with audio)               | Project media reference                          |
| **Master soundtrack** | Exactly one audio program selected for the song                                          | Project/Video media routing                      |
| **Background asset**  | Original video, uploaded image, or separate short video                                  | Visual design                                    |
| **Visual design**     | Named, persistable background strategy and look (footage, effects, visualizer, branding) | Video settings                                   |
| **Output variant**    | Resolution/aspect ratio, lyric presentation, optional excerpt, and layout overrides      | Design-independent preset + per-design overrides |
| **Thumbnail**         | Separate still-image design using `ThumbnailTemplate` modes                              | Thumbnail tab                                    |
| **Export job**        | Frozen combination of project, visual design, output variant, and resolved props         | Export workspace                                 |

A project can have **multiple visual designs**, each eligible for several output variants. One output variant may require specific layout overrides for a particular design, but phrase data, occurrence IDs, translations, and timing remain shared.

A selected imported MP4 may be _both_ the source of the soundtrack and the selected original background. The UI should not duplicate the underlying media object or output two soundtracks.

## 3. Video workspace interaction design

### 3.1 Layout

Keep the existing dark visual language, top navigation, and project actions. Suggested desktop hierarchy:

```text
Video settings                                   Project: [song title]
[Video] [Thumbnail]

Visual design   [Original footage ▾] [+ New design] [Rename / Duplicate / Remove]
Preview variant [Landscape · with Pinyin ▾]

┌────────────────────────────┐ ┌─────────────────────────────────────────────┐
│ SETTINGS                   │ │ LIVE REMOTION PREVIEW                        │
│ Background                 │ │                                             │
│   Original / Image / Loop  │ │          actual selected composition        │
│ Media                      │ │                                             │
│ Visualizer / effects       │ ├─────────────────────────────────────────────┤
│ Lyrics / layout            │ │ ▶  01:24 ━━━━━●━━━━━━━━━━━ 04:14   Fullscreen│
│ Branding / advanced        │ │ Variant, source and missing-asset status    │
└────────────────────────────┘ └─────────────────────────────────────────────┘

                                         [Go to Export →]
```

- Settings panel: roughly 340–380 px, with **contextual controls** and collapsible advanced groups. Preview gets remaining width.
- Aspect ratio changes the **preview content** while keeping the workspace layout stable; contain the portrait canvas in the preview area rather than making the whole page taller.
- At narrow widths (~390 px), stack settings and preview; use a compact variant selector, no horizontal overflow, and accessible player controls.
- Avoid duplicate global save, undo, or stage navigation controls.
- Changing design or variant must not reset the playhead unless the selected excerpt excludes the current time; then seek to the excerpt start.
- Clear distinction between **visual design selection**, **variant currently being previewed**, and **variants selected for export**.

### 3.2 Visual design management

- Provide at least one design. New designs can start from the existing `legacy-video` / `legacy-image-visualizer` looks or from a current design, and are named for user comprehension (e.g. `Original video`, `Pastel artwork`).
- Support add, select, rename, duplicate, remove (with confirmation if referenced by selected export jobs); don't delete assets or affect other designs.
- Keep a small, typed set of user-facing presets + overrides. Applying a preset must have a predictable preview and must not mutate lyrics or timing.
- Selecting the **background mode** only changes that design, not all designs or its sibling variants.
- A design can be previewed with any supported variant even when that variant is not selected for export.

### 3.3 Background modes

**A. Original music video**

- Offer `Use imported video` when Song media contains a usable video stream; otherwise show `Choose video` / `Relink video` and explain unavailability.
- Keep footage aligned to the song timeline. Expose safe creator controls only when supported by the template: framing (`cover` / `contain` or crop), dimming, and relevant overlays.
- Do not assume every imported video has audio or that its audio is automatically the exported soundtrack.

**B. Still image + optional visualizer**

- Choose artwork, optionally reuse a thumbnail image, and configure fit/crop, visualizer enable/style/colors/intensity, plus existing bass-pulse and blur effects when the component supports them.
- Preserve legacy `ImageVisualizerTemplate` appearance under its preset.

**C. Looping video + optional visualizer**

- Choose a short video **independent of the song soundtrack**; its embedded audio is always muted.
- Controls: clip start/end trim in `mm:ss.mmm`, playback speed (default 1× if feasible), loop mode, fit/crop, optional dimming and visualizer settings where supported.
- Modes:
  - `Repeat`: forward → forward → forward…
  - `Ping-pong`: forward → reverse → forward…
  - `Once`: forward once, then hold the final visible frame.
- Loop fills the **full audio timeline** (or selected short excerpt) without gaps. `Ping-pong` must not stutter at turnarounds due to a duplicated endpoint frame; define and test the exact boundary-frame convention.
- Do not reverse or otherwise modify the master soundtrack. Background playback remains silent.
- **Technical gate:** Verify preview and final-render support for reverse playback in the actual Remotion/video stack. If it requires local preprocessing (e.g. a reversed media derivative), propose the least-invasive reuse of existing media/FFmpeg tooling, cache by source and trim/settings, and keep originals untouched. No dependency/runtime installation or silent workaround. Don't claim full ping-pong support if only a CSS preview can display it.
- Unsupported codec, reverse-processing failure, or missing clip produces an actionable message; the user's project and other modes remain usable.

### 3.4 Song soundtrack routing

- Default to the audio already used in Timing. The source may be an audio file or the audio stream in the imported MP4.
- If the original-video design uses a video file with embedded audio, resolve **one** authoritative audio route. Do not play the video track _and_ a separate soundtrack simultaneously by accident.
- Expose the soundtrack reference and meaningful source selection when distinct media are available; do not imply the background controls select a new master soundtrack.
- For alternative still/loop designs, keep the project soundtrack, and silence background video audio.
- Preview and final render must apply the same source/mute/offset policy. Any A/V offset is explicit and must not change occurrence timestamps.
- Avoid expanding into multitrack audio mixing in this feature.

## 4. Output variants and lyric layers

### 4.1 Default variants

| Variant                          | Canvas      | Default lyric intent                                         | Duration         |
| -------------------------------- | ----------- | ------------------------------------------------------------ | ---------------- |
| **Landscape · with Pinyin**      | 1920 × 1080 | Hanzi + Pinyin and existing full-layout translations/glosses | Full song        |
| **Landscape · without Pinyin**   | 1920 × 1080 | Same full-layout content except Pinyin hidden                | Full song        |
| **Portrait short · with Pinyin** | 1080 × 1920 | Hanzi + Pinyin with portrait-safe layout                     | Selected excerpt |

These are **named starting configurations**, not three hardcoded component families. Keep any existing `only-pinyin` legacy look as a separately accessible preset/compatibility mode. In particular, **`without Pinyin` is not equivalent to `only-pinyin`**. Verify precisely which layers the existing `full`, `only-pinyin`, and portrait implementations contain before mapping them to the new options. Their old visuals must remain reachable.

### 4.2 Lyric content controls

Expose a human-readable **Lyric appearance** group, driven by typed visibility flags or named layouts rather than conflated enum values:

- Chinese / Hanzi (on by default for lyric-video variants).
- Pinyin (toggle; enabled in the two requested Pinyin variants).
- English translation, Polish translation, and any existing word-gloss layer, where supported and present.
- Typography/scale, line wrapping, vertical position and safe margins via a small number of meaningful controls. Portrait-specific settings may override shared values.

Do not remove the original presentation differences between legacy `full` and `only-pinyin`; map those to explicit presets or a small set of layout styles. Missing translation/Pinyin content must have a clear fallback and no `undefined` text in output. Do not fabricate translations.

**Precedence**: safe built-in defaults → legacy/built-in visual preset → visual-design settings → output-variant overrides. Define the merge and resolution rules in one pure, testable adapter; avoid parallel preview and rendering logic.

### 4.3 Short excerpts

- Let the creator select a short's `[startMs, endMs)` range using readable time fields and, preferably, a **Select from lyric timeline** affordance. The range must satisfy `endMs > startMs` and fit the known soundtrack duration.
- Do not reuse the legacy `sequenceOffset` frame count as the default for other songs. Convert the selected millisecond range to frames at the composition boundary using established timebase rules.
- Preview the **excerpt timeline** correctly; show source-song timestamps as needed, but seek/play only the range selected.
- Cropping/framing for portrait is independent of the landscape variant. Changing portrait scale or framing does not rewrite landscape settings or project lyric/timing data.
- If no valid excerpt is selected, show the short as **Needs range** and prevent rendering that short; full-length exports remain available. Do not quietly render an arbitrary 30 seconds.
- Outro/watermark behavior must be controllable per variant with legacy-compatible defaults; don't force a full-length outro into a short.

## 5. Thumbnail tab

The thumbnail UI is a **separate tab** within Video, with its own live still preview and contextual controls. Reuse the reported unified `ThumbnailTemplate` and its actual typed schema.

- Modes: `full`, `only-pinyin`, `title-only`, with existing registered thumbnail composition IDs preserved.
- Controls reflect supported template props (e.g. background image/opacity, music-note watermark/style, top/bottom labels, English title, title words and corresponding readings/glosses).
- Initialize available song title/artist values from project metadata where appropriate, but allow overrides without changing song metadata.
- Provide **Use video artwork** as a one-time copy/select shortcut; it does not continuously link thumbnail asset/style settings to the video design. Thumbnail can also use its own asset.
- Show missing required title/word data clearly; preserve authored readings and translations. Do not automatically overwrite or invent them.
- Thumbnail assets and layout remain independent of playback, clip range and video audio.
- Export can include one or more thumbnail modes as still-image jobs. Confirm the actual existing still output format before specifying encoder details.

## 6. Export workflow — batch of designs × variants

Export is where the creator selects **what to generate**, not where they tune the appearance. Present an actionable job matrix for enabled visual designs and named output variants, plus independent thumbnail jobs.

Example:

| Visual design              | Landscape + Pinyin | Landscape – Pinyin | Portrait short + Pinyin |
| -------------------------- | ------------------ | ------------------ | ----------------------- |
| Original video             | ☑                  | ☑                  | ☑                       |
| Still artwork + visualizer | ☑                  | ☑                  | ☑                       |
| Looped atmospheric video   | ☐                  | ☐                  | ☐                       |

- Each checked combination is a separate export job with deterministic resolved props, composition dimensions, FPS/time range, and a predictable filename incorporating song/design/variant (handle collisions safely).
- A project may export only one job or many. Never force a full Cartesian product when the user wants a subset.
- Show readiness per job: `Ready`, `Missing media`, `Missing short range`, `Missing required timing/translation`, or render failure with explanation.
- Present render progress, successful outputs, and recoverable failures independently. One failed job must not silently discard other successful jobs.
- Keep render/download actions explicit. Changing Video settings or selecting a preset must not launch rendering or write to arbitrary files.
- Reuse current export capabilities and scripts; don't replace project JSON/legacy TypeScript export. If video rendering through the workbench is not yet available, stage the work transparently and keep manual Remotion CLI rendering functional, with complete deterministic job configuration exported or supplied to that path. **Do not present a fake Render button**.
- Preview the exact selected design+variant from Export by opening Video at that selection without losing job selections.

## 7. Media asset and project persistence contract

Current architecture documentation says local `File`/`Blob` object URLs are session-scoped and arbitrary local media is **not bundled** in project JSON. Design the feature accordingly.

### 7.1 Durable state

Persist in the canonical workbench project JSON:

- Visual designs, their IDs/names/presets, background kind, selected asset references, trim/loop/effects, and soundtrack routing policy.
- Output-variant definitions and sparse per-design layout overrides, including short excerpt range.
- Thumbnail modes, content and style overrides, and media references.
- User's selected/last-previewed design+variant, if appropriate as workspace preferences rather than essential rendering data.
- Export selections (optional, if useful) without storing generated binaries.

Keep the actual schema consistent with the repository's validator/versioning conventions; do not paste an illustrative JSON object into the code as a rival domain model. Add optional fields or a controlled version migration after inspecting the current schema, and ensure older JSON/legacy songs open with safe defaults. Don't reassign lyric occurrence/phrase IDs, group membership, reviewed flags, translations or timing when modifying visual settings.

### 7.2 Asset relinking and resolution

- Save stable metadata such as display filename, duration/dimensions when available, media kind, and **safe references**, not browser object URLs or machine-specific paths as though they were portable.
- In the current session, reuse imported file bytes or their existing session-level media handle for preview. After reload/JSON reopen, display the saved media label and an explicit **Relink** action.
- Missing assets do not corrupt the project or clear the user's configured designs. Each affected preview/render job indicates exactly which reference needs relinking.
- Establish how a chosen browser-local asset reaches the local Remotion renderer (and how a reverse-video derivative is resolved). A browser `blob:` URL cannot be assumed to work for CLI renders. Inspect the existing server/asset pipeline and propose minimal safe bridging.
- Never silently copy/import arbitrary files into the Git repository or bundle copyrighted media into project JSON. Avoid new network services or cloud uploads.

## 8. Preview and technical integration

### 8.1 Remotion adapter

Reported local files (verify in working tree):

- `src/remotion/templates/VideoLyricTemplate.tsx` — original video background; `lyricMode`, landscape/short variant, `sequenceOffset`, branding/outro.
- `src/remotion/templates/ImageVisualizerTemplate.tsx` — image, audio, bass pulse/blur, two-pass FFT visualizer, aspect adaptation.
- `src/remotion/templates/LyricVideoTemplate.tsx` — discriminated `type: "video" | "image-visualizer"` wrapper.
- `src/remotion/templates/ThumbnailTemplate.tsx` — `full | only-pinyin | title-only` still modes.
- `src/Root.tsx` — legacy and reusable composition registrations.

Extend the existing strategy where possible instead of creating three nearly identical lyric scenes. Consider the new loop-video background as a background strategy in the shared composition, not a source of a second lyric/timing engine.

- One resolved prop object must feed both Remotion Player/thumbnail preview and the export renderer.
- Ensure the workbench video UI does not assume the old sidebar or hardcoded song media/composition durations.
- Use source-project occurrence order and timestamps. Maintain chosen FPS/rounding contract at the renderer edge; avoid moving lyric timestamps to fit a background loop.
- Preserve old composition registrations, Studio schemas/default props and legacy reference appearance.
- Detect actual constraints of the current browser, OS and Remotion binaries before promising server-side render behavior. Do not install/upgrade browsers, FFmpeg, packages, or system dependencies without approval.

### 8.2 Preview states and usability

- Remotion live preview with play/pause, seek, time display, fullscreen when supported, and switchable output variant.
- Preview should not render a sample song when the actual project lacks lyrics/timing/media without an explicit **Demo preview** label. Prefer a useful missing-data state.
- Clearly mark local changes and provide informative loading, decoding, relink and render-support errors.
- Avoid frequent player teardown on every slider movement. Debounce expensive settings/asset analysis as needed; keep simple visual changes responsive.
- Portrait preview is contained/scaled into the preview region. Video and Thumbnail tabs preserve their own last-used settings.
- Keyboard interaction and labels, visible focus states, accessible form controls, and no nested page-spanning lists or accidental horizontal overflow at 390px.

## 9. Scope boundaries and deferred work

**In scope**: video workspace UI, actual template preview, media/source routing, all three background modes, loop trimming and playback including ping-pong, visual designs, requested default variants including true no-Pinyin, portrait excerpt, thumbnail tab, persisted configuration, and a credible path for batch exports across designs and variants.

**Not in scope unless code inspection shows an unavoidable dependency:** rewriting Import, Timing, translation logic or word segmentation; full nonlinear video editing; effect keyframe editor; transitions between multiple background clips; audio mixing; social publishing; cloud rendering; YouTube downloading; automatic cover-art generation; generic composition builder; automatic dependency/browser installs.

Small Import label adjustment from `Audio` to **Song media (audio or video)** can be proposed separately to avoid confusing the workflow; don't modify the entire import feature under this spec.

If current repository capabilities prevent complete implementation in a single approved slice (notably browser-to-renderer asset bridging or ping-pong reverse preparation), document a dependency and **continue with independently verifiable increments**, without claiming the feature is done. The final accepted goal remains unchanged.

## 10. Acceptance criteria and verification

### Media/background

- [ ] Imported MP4 is selectable as original background and remains the same song's audio source where applicable.
- [ ] A source MP4 containing merely a still picture can be replaced visually by an image+visualizer design, without retiming lyrics or replacing the soundtrack.
- [ ] A separately selected short video loops for a song longer than the clip, muted, with no visual gaps; visualizer option is honored.
- [ ] Ping-pong plays forward/backward/forward in **preview and rendered artifact**, including around both turnaround boundaries. Master soundtrack is neither reversed nor doubled.
- [ ] Missing/relinked source and alternate background assets are clearly identified; cancel/failure doesn't destroy project settings.
- [ ] All modes produce **exactly one** audible soundtrack; check especially video-with-embedded-audio + master soundtrack.

### Variants and thumbnails

- [ ] Landscape with Pinyin, landscape **without Pinyin**, and portrait short with Pinyin are separate previewable/renderable configurations.
- [ ] Without Pinyin removes the Pinyin layer without accidentally choosing the existing `only-pinyin` mode or hiding translations that should remain in the selected layout.
- [ ] Short uses the selected millisecond range; correct lyric alignment and portrait framing; missing range blocks only short jobs.
- [ ] At least two distinct designs can generate independently selected variants without duplicating the project's lyrics/timing.
- [ ] Thumbnail `full`, `only-pinyin`, and `title-only` modes retain their legacy behavior, support independent settings and render as still outputs where available.
- [ ] Changing one design, one aspect-specific override or the thumbnail does not unexpectedly change unrelated designs/variants.

### Data and architecture

- [ ] Preview and export resolve the same typed configuration; a change to visualizer color, image crop or lyric visibility appears in both.
- [ ] Old project JSON and legacy song imports open; existing Remotion composition IDs and Studio usage remain working.
- [ ] Project JSON round-trip retains designs, variant/excerpt settings, thumbnail settings and lightweight media references, with relink UI after reload.
- [ ] Editing visuals leaves phrase, occurrence, translation, group, and timing IDs/data unchanged; project edits are undoable using the existing policy.
- [ ] No media bytes are silently embedded in JSON or written into the repo.

### UI, output and regressions

- [ ] Desktop (e.g. 1600 px) and mobile (~390 px) screens have no horizontal overflow; portrait preview stays contained.
- [ ] Video and Thumbnail settings are discoverable, preview is usable, and Go to Export opens the correct job selections.
- [ ] Export lists selected design × variant jobs, reports readiness and per-job progress/errors, and produces distinguishable outputs for successful jobs (or transparently exposes the existing manual render route until integrated).
- [ ] Legacy reference frames and audio remain equivalent under their original defaults; intentional differences are explicitly documented.
- [ ] Typecheck, lint, applicable unit/domain/browser tests and Remotion composition enumeration pass. Capture representative frames (intro, active lyric, repeat, outro, long line, portrait crop, background loop turnaround) and thumbnails. Test at least one actual output file for visual/audio correctness—not only UI screenshots.

## 11. Rendering boundaries

Direct export renders a single video per request. Batch selection prepares Studio props for multiple videos or thumbnails. Direct thumbnail downloads and queued batch encoding are outside this implementation.

## 12. Implementation and verification record

The workbench stores visual settings as an optional part of the version-1 React project. New jobs share the project occurrence order and authored text. Video uses Remotion Player and Thumbnail uses the still player. The loop background uses Mediabunny to decode the required source frame on demand in both environments. It requires a browser-decodable clip. There is no reverse derivative to prepare or install. Trim and speed affect the visual clock only. The loopback service stages media on explicit export preparation. Each downloaded job contains frozen scene props and a suggested Studio output name.

The workbench now exports one selected design and variant directly as MP4 or WebM using the shared video composition. Users select a codec, 1080p or 4K, frame rate and bitrate. Auto FPS is sampled from original or loop footage and is 30 fps for artwork. Full-song exports can remux compatible encoded audio. Excerpts use audio encoding for cut timing. The Export workspace shows progress and supports cancellation, retry and download. The Studio preparation matrix remains available below it. The codec list checks browser support and prefers hardware-capable options by default. A separate short encode probe checks the selected settings. The cached Chromium reported 4K H.264/AAC capability but failed the encode probe. The owner’s browser still needs verification at that setting.

The owner exercised the original-footage Studio handoff and approved the legacy Pinyin placement. Browser verification subsequently produced original-footage, image/visualizer portrait and ping-pong WebM outputs and PNGs for all three still modes. The ten-frame loop regression compares Player seeks with decoded output and checks a single soundtrack at the expected level. Desktop and mobile Video checks used 1600 px and 390 px viewports. Project tests cover old jobs, conditional readiness, variant isolation, frame rounding and JSON round-trip.

The sandbox could not fetch the Google Fonts assets. Composition enumeration and controlled legacy frame comparisons used the same substitute font environment for both versions. Final typography on the owner's normal Studio installation remains a visual review item. See [the workbench guide](../../../../web/README.md#video-designs-and-studio-web-export) and [the regression record](../../TEST_PLAN.md#m5--ui-to-remotion).
