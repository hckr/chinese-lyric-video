# Local audit — 2026-11-12

Audited checkout `677159d` before implementation. No staged changes. Existing unstaged changes: README's Python app link and .gitignore rules for local projects, Python environment/caches and skills. Untracked valuable work: `pytest.ini`, `python-src/app.py`, `.streamlit/config.toml`, requirements/dev requirements, README, evaluation script, tests, all `python-src/workbench/`, `scripts/import-song.cjs`, and this specification package. None is discarded, moved, stashed or reset. Source songs and public assets remain authoritative. Existing local project JSON and .env must stay private.

## Registered compositions (src/Root.tsx)

| ID | Source | Size | FPS | Frames | Behavior/assets |
|---|---|---|---|---|---|
| LyricVideo | LyricVideo.tsx | 1920×1080 | 23.976 | 5196 | Keep Walking MP4, embedded audio; full word/EN/PL; dark overlay; watermark; outro at5015, hearts5043, second line5098; two Lotties |
| LyricVideoOnlyPinin | LyricVideoOnlyPinin.tsx | 1920×1080 | 23.976 | 5196 | Same footage/audio/outro, different Hanzi/Pinyin layout, without full translation/gloss |
| LyricVideoShort | LyricVideoShort.tsx | 1080×1920 | 23.976 | 852 | Keep Walking footage/audio and lyrics inside Sequence from−1074; portrait wrapping/padding; no full outro |
| LyricVideo2 | LyricVideo2.tsx | 1920×1080 | 25 | 4612 | Macchiato cover image; one Html5Audio using Macchiato MP4; full lyrics, watermark; FFT bars and bass pulse/blur; no outro |
| Thumbnail | LyricVideoThumbnail.tsx | 1280×720 | 1 | 1 | thumbnail-bg-369.png, full title word glosses and labels |
| ThumbnailOnlyPinyin | LyricVideoThumbnailOnlyPinyin.tsx | 1280×720 | 1 | 1 | same image, Hanzi/Pinyin title variant |
| Thumbnail2 | LyricVideoThumbnail2.tsx | 1280×720 | 1 | 1 | vlcsnap image, alternate title/layout/labels |

All videos convert each boundary with Math.round(ms/1000*fps), use end-exclusive Sequence durations, and fall back to five seconds when end<=start. Do not reinterpret zero placeholders as actual synchronized timings. Short offset is composition-specific, not song timing. Remotion config enables client-side rendering, JPEG, overwrite and scale2. Browser preview uses @remotion/media Video; server rendering uses OffthreadVideo. Do not introduce a second audio element.

Named repeated blocks: font loaders (NotoSansSC/Inter/LexendDeca), heavyTextShadow helpers, word/translation rows, ms/frame conversion, dark lyric overlay, watermark; hearts/Lottie/outro shared only by full and pinyin landscape variants. Thumbnail typography is similar but framing and title content differ. LyricVideo2 draws Visualizer twice: preserve this actual appearance until baselined; it is not two soundtracks. The old roadmap incorrectly describes LyricVideo2 as MP4 footage; actual background is an image with audio from MP4.

## Media inventory

`public/`: Keep Walking MP4 (~83MB), Macchiato MP4 (~5.1MB), macchiato_cover.png (~1.9MB), thumbnail-bg-369.png (~1.2MB), vlcsnap-2026-06-20-20h55m06s209.png (~928KB), grin-sweat.json and heart-face.json Lotties, CC-CEDICT (~9.4MB). Media are locally ignored, not bundled into project downloads. No absolute media paths in song exports. Fonts are currently loaded by Remotion Google-font helpers; web editor uses local fallbacks.

## Contracts and Python reuse

Two real songs use literal TIMELINE/LYRICS_DICT and a default object with title, artist and a lines getter mapping each occurrence to its dictionary entry. Keep Walking also uses a named shared words array and spread, as const, non-ASCII keys, empty-Hanzi annotations, multiline glosses, parenthesized lexical tokens and a manually spaced `bù qīng`. Macchiato's timeline repeats shared phrases. Preserve all these, including unused dictionary entries, order, timestamps and punctuation. Do not silently repair manual Pinyin; flag internal spaces and offer explicit correction. Export uses the actual getter contract, not a new renderer schema.

`workbench/models.py` has versioned Pydantic projects and atomic JSON storage; `songs.py` has OpenCC ingestion, deduplication, cached CC-CEDICT/Jieba and TS export; `generation.py` validates independent results, retries/splits and checkpoints; `transport.py` loads .env server-side and bounds retries/timeouts; `prompts.py`, `pinyin.py`, `vocabulary.py`, `responses.py`, `generation_plan.py` are UI-independent. Keep all for checkpoint C. Existing Python project schema has no token IDs and zero timing placeholders; React JSON is a distinct versioned format with stable token IDs and nullable raw timing. Explicit adapters will be needed. Existing Node importer only supports Macchiato literals: the React importer must support shared const references/spreads without execution, without destabilizing the Python helper.

## Tooling and baseline strategy

Installed: React19.2.3, Remotion4.0.484, TypeScript5.9.3, Zod4.3.6, esbuild0.28.1 (through existing Remotion tooling). Reuse these for the separate web app; no dependency install required. Node22 is locally installed under `/Users/luke/n/n/versions/node/22.20.0/bin/node`; default Node16 is too old for current ESLint. Python venv remains in python-src. Existing known lint failures: unused useId in two renderer files; tsc also lacks resolveJsonModule for Lottie imports. Report rather than change renderer incidentally.

Existing cached Chrome headless shell and installed Chrome are available; do not install a browser. Baseline strategy: existing Remotion CLI/API renderStill with original entrypoint, explicit existing browser and scale1; capture intro, active lyric, repeat, long line, outro for each video plus each still. Persist manifest/frames under ignored out/reference before any renderer extraction. Capture must include the real audio-data-dependent image visualizer. No pixel-equivalence claim until these renders exist. Checkpoint A can proceed with src unchanged; checkpoint D is blocked on completed reference coverage, not on speculative abstractions.

## Roadmap reconciliation

Append the new gated migration to agent-docs/ROADMAP.md and retain its historical plan. Python/backend and Streamlit already exist; do not recreate core/ or prematurely remove Streamlit. New priority is A React file workflow (including segmentation), then B timing, C Python bridge, D baselined renderer consolidation, E real preview/config integration. No source-song relocation, automatic registration or fake waveform/preview. Review each checkpoint before opening the next major architecture change.

## Executed checkpoint A findings

- Python baseline: 69 tests pass; no Python/Streamlit code changed in checkpoint A.
- Actual composition enumeration confirms the three Still registrations use **fps1, duration1**, all1280×720. Videos match the table above.
- Reference artifacts: `out/reference/1794522984168/` contains compositions.json, results.json, all three thumbnail PNGs and LyricVideo2-500.png. Footage captures for LyricVideo/LyricVideoOnlyPinin/LyricVideoShort fail in the existing bundled ffprobe: missing macOS AVFoundation `_AVCaptureDeviceTypeContinuityCamera`, SIGABRT. This is not a React regression; source files are unchanged. Full reference coverage remains an explicit gate before checkpoint D.
- An edited TS generated by the new adapter renders through unchanged LyricVideo2 at frame100: `out/workbench/export-check-69OnbM/edited.png`. The image was inspected and shows “Workbench export verified” in the original layout. Replacement is bundle-only; the original song was not overwritten.
- Original Studio CLI (`studio --no-open`, temporary port3002) starts and builds; stopped after verification. New web command starts loopback5173 and never opens a browser; also stopped. Browser tests use their own temporary server and close it.
- Existing root lint/typecheck failures were reproduced; new web typecheck and web ESLint pass independently. Root tsconfig now excludes web because it is a separately checked browser project.
- Only added dependency: @types/react-dom19.2.3 (development declarations missing from checkout). No new runtime dependency, browser, Python library or AI calls.
