# React Lyric Workbench — file editing and timing

From the repository root:

```sh
npm run workbench
```

Open **http://127.0.0.1:5173** yourself. The command never opens a browser. The separate Remotion command remains `npm run dev`. Use Node 22.20.0 or newer; .n-node-version pins the installed version used for verification. With n, use `n exec auto npm run workbench` without changing your global Node selection. No runtime or browser was installed.

1. Paste lyrics or load a .txt file in **Import lyrics**. Enter title and artist separately. Each nonblank lyric line creates one occurrence, including credits and punctuation. Type `[Chorus]` to start a section and `[/]` to return to ungrouped lyrics. Use the preview to jump to a line. Correct length or heading errors in the editor. **Review with AI** proposes individual heading and line-break patches. **Compare with audio** opens optional transcription and insertion review after you attach audio. **Import document** creates the project without requiring either analysis. To replace an open project, download a backup if needed, then confirm **Discard project and start import**. This immediately clears its audio, history and recovery copy. The new draft survives workspace navigation. See the [editor guide](../agent-docs/react-workbench/features/lyrics-import-enhancements/EDITOR_UX.md).
2. **Translations** lists every unique phrase. Occurrence counts and timestamps are in the inspector; repeated occurrences share edits. Edit English, Polish and word rows directly. Changes save in this browser; download JSON for a portable backup. JSON restores stable IDs, review status and approved segmentation. The old Python project JSON is a different format and is deliberately rejected rather than misread.
3. Select a word row, then **Split word** or **Merge with next** above the word table. Choose a Hanzi boundary for splitting and review the editable readings/glosses before confirming. **Undo/Redo** restores the previous edit. See [the segmentation contract](../agent-docs/react-workbench/WORD_SEGMENTATION.md) for identities, preservation and Pinyin rules.
4. Use **Fix spacing** to explicitly join a word’s supplied readings. Meaningful idioms can keep spaced Pinyin. Review warnings identify missing/invalid readings, glosses and Chinese character coverage.
5. **Mark phrase reviewed** records review and segmentation approval once validation passes. **Mark as needing review** returns the shared lyric to pending while preserving edits, segmentation approval and occurrence timing. Undo and Redo restore the review state. Editing a sentence invalidates review without erasing segmentation approval. Editing word structure invalidates its approval. Download project JSON to retain workbench metadata; legacy TS carries only the renderer's established data contract.
6. **Export data** lists warnings and previews the actual TS. Download the legacy module, manually place/reference it under `src/`, and use the existing Remotion workflow. Missing raw timings remain null in JSON and become warned zero placeholders in a TS draft. Incomplete/unreviewed/invalid manual data requires explicit acknowledgement before draft download; it is never silently normalized. The app never overwrites source files.

Raw import uses the local Python OpenCC/Jieba/CC-CEDICT pipeline to simplify Chinese text, strip headings/credits and draft word rows and unambiguous readings while preserving repetitions. Contextual glosses and English/Polish sentences start empty. The dictionary inspector shows reference definitions. There is no paid AI request or browser API key. Raw import does not upload audio/media. Automatic timing and occurrence review are available in Timing. Video settings and Remotion Player preview are available in Video.

Browser recovery stores the current project, not the undo stack. History is bounded to 100 edits; source imports begin a new history. Reselecting a phrase preserves its committed edits. Save a portable JSON before clearing browser data. The browser's static TypeScript parser adds bundle size (roughly 11 MB unminified development JS); this avoids introducing an API/server merely for local file parsing.

## Timing workflow (checkpoint B)

1. Open **Timing** after importing a song or raw lyrics. **Lyrics** lists every timed appearance, including repeats. Select a sidebar row or timeline block to seek to its start, both paused and playing. In the lyric editor, each appearance has a **Timing** button that opens its own timing selection; **Translate** returns to the shared phrase editor.
2. Timing uses the audio selected during raw import. You can also choose local audio here, including a supported video container used for its soundtrack. After reload, including a development-server live reload, Timing shows **Audio needs relinking**. The saved filename appears beside **Relink audio**. One native audio element owns playback and `currentTime`; playback itself uploads no media. Playback speed, padded Play lyric/Loop selected, the labelled seek slider and ruler/waveform clicks use that clock. Global Play/Space cancels bounded replay.
3. Enter integer **Start/End milliseconds** and click **Apply timing**, or press **S/E** to capture the current playback position. Empty fields are unassigned. For a raw cue capture start then end. To move an existing interval beyond its end, edit both fields together or set the end first. Negative, fractional, zero-length and past-duration edits retain the last valid interval and show an error. Overlaps are allowed as drafts with warnings.
4. Drag a cue body to move it or an edge to trim. Previews and committed drops may overlap other cues; overlapping drafts show warnings. A successful drag is one undo step. Moves preserve duration, media bounds are enforced, and other appearances, phrase review and segmentation remain unchanged. Imported overlaps remain intact and are flagged; ordinary gaps are not warnings.
5. **Zoom** starts at **8×**. Zoom keeps the playhead visible, or anchors the selected cue without audio. **Snap** defaults to **Neighboring edges**, within 100 ms; Off remains available. No frame-rate or beat snapping is exposed, and imports are never quantized.
6. While paused, drag the timeline background with the hand cursor to pan. Clicking without dragging seeks. At 1× the entire song is visible. During playback, horizontal panning is locked and follow scrolls after the playhead passes **15/16** of the visible width, placing it at **1/16**, clamped at song boundaries. Pausing stops any ongoing follow animation and restores panning.
7. Selecting a lyric reveals it in both panels. The fixed-height preview and equal-width Previous/Next/Translate buttons keep navigation steady. **Undo/Redo** stays in the sticky workspace header. Programmatic selection, zoom and follow scrolling use the native smooth-scroll API; hand-panning stays immediate.
8. Focus a cue body/edge and use ←/→ for 10 ms, Shift for 100 ms. Elsewhere, Space plays/pauses; S/E captures boundaries; ←/→ seeks 100 ms, Shift 1 s; Alt+←/→ adjusts the last selected target by 10 ms, Shift 100 ms; `[`/`]` selects the previous/next lyric. Keyboard adjustments permit overlaps with warnings.
9. **Reset timing for this lyric** restores its last-reviewed interval, otherwise its latest automatic suggestion, and is undoable. Editing invalidates occurrence review; Mark reviewed records current bounds. Valid legacy JSON without review metadata migrates to Reviewed with a current-value reset snapshot; old timing baselines are retired.
10. Download project JSON or legacy TypeScript as before. JSON stores original timings and lightweight audio filename/size/modified-time/duration metadata, never media bytes, absolute paths or object URLs. Reloading requires selecting audio again; leaving Timing pauses playback. Choosing audio is independent of edit history, so Undo/Redo retains metadata for the currently selected file. Legacy TS exports exact ordered IDs and integer timestamps, with warnings for missing/invalid/overlapping timing or intervals beyond the saved audio duration.

**Review splits** opens a long Whisper discovery in Timing. Put each spoken line on its own row. A word-aligned break keeps the pause between the two tokens. A blank boundary requires a millisecond value. Use **Listen** or **Play piece**, then **Add reviewed lines**. Undo restores the candidate. **Edit song structure** lets you name or regroup these lines without changing their timing or translations. Apply returns to the paused Timing workspace.

Waveform analysis runs in the browser and is skipped for files over 32 MiB or
eight minutes. Playback and ruler editing remain available when the browser can
play the media. No media is uploaded.

The JSON schema remains version 1 with optional timing review, run, settings, and audio metadata. Old `timingBaseline` data is retired on save. Existing version-1 projects load; older strict workbench versions may reject files with these new fields. Legacy TS omits workbench metadata. Video settings persist in project JSON. Video previews use Remotion Player. Export supports direct browser video downloads and prepares props for manual Studio web rendering.

Beat detection is deferred after the fixed-tempo experiment proved unreliable on real music. The review workflow and its verification record are documented in [Automatic Timing & Review](../agent-docs/react-workbench/features/automatic-timing-review/SPEC.md).

## Automatic translation

Select a configured provider and model beside the translation action. To switch after a limited run, select the other model and retry unfinished work. Custom Gemini model IDs remain available in Model settings.

Translation waits and retries temporary provider errors automatically. For Gemini HTTP 429 it waits at least one minute and honors longer Gemini retry delays. Groq starts with batches of up to four lyrics. Repeated rate limits can shrink a multi-lyric batch after the provider retry delay. Gemini also shrinks batches after repeated input-token limits. Progress shows the operation being retried and the number of validated drafts. Run details explain when an incomplete or invalid response triggered another request. Vocabulary prompts prioritize segmented words within an 800-character dictionary excerpt per lyric. Run details follows new messages while scrolled to the bottom. Expand **Debug prompts and responses** there to inspect batch prompts and model text. The debug history lives in browser memory for the open project and clears on reload or when opening a project. Use **Cancel translation** to stop waiting. Confirmed daily quota exhaustion and zero allowance end the run with the provider reason.

Choose **Translate whole song** after importing lyrics. It drafts missing word
readings, contextual glosses, and English and Polish sentences. Repeated
appearances share a draft, and the whole song supplies lyric context. Existing
readings, glosses, and word boundaries are protected during fill-missing runs.
For a narrower scope or the model settings, open **Translation options**.
For projects that already contain dictionary definitions in gloss fields,
choose **Draft replacement glosses** to propose contextual wording for the
current word breakdown.

Translation actions send lyrics and optional song notes to the selected provider through the
loopback server. Set `GROQ_API_KEY` or `GEMINI_API_KEY` in the Python process environment,
`python-src/.env`, or the repository `.env`. Import, editing, review, and export
work locally. For Groq, select **Thinking effort** beside the model. Groq defaults to Off for Qwen and Medium for GPT-OSS. Higher effort can consume more tokens. The choice applies to generation and revision. You can edit, dismiss, and apply a lyric’s drafts once its requests finish. Model revisions become available when the run ends. Translation continues when you switch Workbench tabs. **Cancel translation** stops the worker and retains received
drafts. A partial run shows counts for vocabulary, English, and Polish.
On resume, the worker drafts missing sentences for lyrics with usable vocabulary first. Each new vocabulary batch is followed by its requested sentence translations before the next batch starts.
Open **Run details** for grouped provider failures and sentences waiting for
vocabulary. **Retry unfinished** skips drafts already received.

Choose **Review drafts** to jump to a lyric with proposals. Use **Next draft**
or select a marked phrase. Proposed readings and glosses appear in the word
table, with changes highlighted and previous values shown when available.
English and Polish sentence drafts convey a metaphor’s intended meaning in context. The English word gloss gives both its literal image and its figurative sense on separate lines. Proposed sentences appear in the English and Polish fields. **Apply draft**
saves the eligible proposals for the selected lyric. A sentence that uses draft
vocabulary can be applied together with that vocabulary or after it. Use **Revise** or **Dismiss** beside the sentence or word breakdown, **Revise this word** on the selected row, and **Fill missing fields with … drafts** beside **Review drafts for … lyrics**. Applying content supports
Undo. Generation scope controls which lyrics receive new drafts. Fill missing skips valid replacement drafts too. Draft replacements can regenerate selected parts again. Song-wide application accepts eligible fill-missing drafts across all lyrics without contacting the model. **Revise lyric…** lets you select one or more parts and give them a shared instruction. The form identifies the selected translation model. Sentence revisions use the current sentence drafts and valid vocabulary draft even before application. Revision results appear beside the lyric’s review controls. **Draft sources** lists each original model separately. Drafts and applied provenance persist in autosave and Workbench JSON.
Legacy TypeScript contains the applied lyric content.

Run the offline browser acceptance with `node web/tests/browser.ts --translation`.
For an optional live quality check, the following command sends the sample to
Gemini and writes results to an ignored output directory.

```sh
python-src/venv/bin/python python-src/evaluate_translation.py python-src/tests/fixtures/translation-evaluation.txt --live --output out/workbench/translation-evaluation
```

## Video designs and Studio web export

Attach the song media during Import or Timing. Open **Video** to add a named design, choose original footage, artwork or a loop, and choose a variant. Select **Load preview** to start the Player and **Close preview** to release it. The default soundtrack is the Timing recording. **Master soundtrack** can select another playable recording. When original footage supplies the soundtrack, the preview plays its picture and sound together in one native video element. Choosing another soundtrack mutes the footage.

Use **Landscape · only Pinyin (over Hanzi)** for the original centered overlay. **Landscape · without Pinyin** keeps the full translation layout. For a portrait short, apply an excerpt in minutes, seconds and milliseconds. Each design and variant can override lyric visibility, framing, margins, scale, position and branding. Loop clips have an independent trim, speed and repeat, ping-pong or final-frame hold. **Thumbnail** edits the still modes and can reuse the selected design's artwork.

In **Export**, choose a design and output variant under **Render and download video**. Set the container, codec, resolution, frame rate and video quality or bitrate under **File settings**. **Auto** measures the video background’s frame rate from its packets and uses 30 fps for still artwork. Codec options automatically show browser-reported availability and hardware preference. The initial selection prefers a codec that passed the hardware-preferred check, including switching to MP4 when only MP4 codecs pass. Manual selections take precedence. **Check encoder support** encodes a short test file and tries a hardware-preferred configuration. Browsers can fall back to software. **Copy audio when possible** preserves compatible full-song audio packets. Excerpts and incompatible tracks use encoding, with the reason shown before rendering. Select **Render video**, wait for encoding, then use the download link. The workbench renders one video at a time in a browser with WebCodecs encoding support. Leaving Export cancels an active render and releases its download.

Under **Prepare for Remotion Studio**, check the individual design/variant cells and thumbnail jobs, then choose **Prepare selected jobs**. Download the props for each successful job. Keep this workbench server running, launch Studio using the command beside that download, select **Workbench-Video** or **Workbench-Thumbnail**, and choose web rendering. Studio reports render progress and offers the encoded output. A server restart expires the temporary asset URLs. Reopen the project, relink the requested files and prepare the jobs again. Project JSON stores settings and media labels. Prepared props reference files in the local server's temporary directory.

Run `npm run workbench:test:video` for a local browser regression that compares Player frames with an encoded WebM across both ping-pong turns and measures the decoded soundtrack level.

## Application versioning

The root `package.json` version is the single source of truth, starting at
`0.1.0`. The React navigation imports it directly and displays `v` followed by
that version beneath “Lyric Workbench” across all workspaces, including before
import. Keep the top-level and root-package versions in `package-lock.json`
synchronized when changing it.

- Use Conventional Commits for commit messages: `type(scope): description`
  (scope optional). Use `feat` for features, `fix` for bug fixes, and `docs`,
  `test` or `refactor` for those changes. Version bumps follow the
  accepted-task rules below; commit types do not trigger automatic releases.
- Accepted feature: increment minor and reset patch (`0.1.1 → 0.2.0`).
- Accepted bug fix or small improvement: increment patch (`0.2.0 → 0.2.1`).
- Documentation, tests and internal refactoring alone: no bump.
- Include at most one bump per accepted task in its reviewable changes. Mixed
  feature/fix tasks receive a minor bump.
- Before bumping, compare the package version in the working tree and index with
  the version at `HEAD`. Keep an existing uncommitted bump when follow-up work
  belongs to the same release, including implementation and review revisions.
- Major-version changes require an explicit decision. Do not add a release
  process, publishing, tags or automation unless explicitly requested.

## Verification

```sh
npm run workbench:check
npm run workbench:test
npm run workbench:build
npm run workbench:test:browser
npm run workbench:test:reference
npm run workbench:test:export
# After browser acceptance, render its actual timed download:
npm run workbench:test:export -- --song out/workbench/timed-export.ts
python-src/venv/bin/python -m pytest -q
```

Browser scripts use the already-cached Remotion headless shell. Set `WORKBENCH_BROWSER` to an existing compatible executable on another platform; they never download a browser. They run temporary loopback servers and stop them. Browser tests cover actual React file inputs/downloads, edits, split/merge, undo/redo, reload, failed import recovery and mobile layout. Screenshots land in ignored `out/workbench/`. The export render check substitutes only a generated temporary song in the bundle, then uses the unchanged LyricVideo2 component. Reference capture writes separate run directories under ignored `out/reference/`, a composition manifest and per-composition results. It returns failure if any capture fails.

The server-side reference helper’s native ffprobe aborts on footage captures because this macOS AVFoundation lacks `_AVCaptureDeviceTypeContinuityCamera`. Thumbnail and image/visualizer stills render successfully. This helper does not exercise the experimental Chrome/client-side renderer enabled in remotion.config.ts, which the owner uses successfully. Footage references must be verified through that configured path before renderer refactoring. Historical static-check limitations are recorded in [TEST_PLAN.md](../agent-docs/react-workbench/TEST_PLAN.md).

The Wiktionary button opens an in-app dialog and follows a unique Chinese soft redirect, avoiding a second click from a Simplified stub to its Traditional lemma. The resolved page is shown in an iframe with Wiktionary’s own layout, styles and navigation. The dialog also offers a link to open it separately. Only that clicked word is queried against Wiktionary's public API. Multiple targets or lookup failures retain the original page. Opening Wiktionary does not change the project text. Close or Escape dismisses the dialog.

The test suite also runs the real Python → TypeScript → React import regression when `python-src/venv/bin/python` exists; it reports that check as skipped otherwise. The web build scripts declare esbuild directly at the already-used locked version instead of relying on a transitive installation.

Remaining checks and known issues are listed in [TEST_PLAN.md](../agent-docs/react-workbench/TEST_PLAN.md). A passing automated suite does not establish completion of every milestone.

All project tooling is TypeScript, executed directly by Node. `npm run workbench:check` checks both the frontend and Node scripts with strict TypeScript settings. `web/package.json` declares the web tooling as ES modules; `scripts/import-song.mts` explicitly marks the Python helper as a TypeScript ES module. No runtime loaders or CommonJS source wrappers are needed. The tests run natively through `node --test`, without a generated test bundle. The existing esbuild dependency is used only for the browser app build. To apply the pinned Node version to both Python and its Node subprocesses, run `n exec auto python-src/venv/bin/python -m pytest -q`.

### Import browser regression

Run `npm run workbench:test:import-workflow` for a fully synthetic Chinese import fixture. It starts its own temporary loopback server and isolated browser, reuses the installed browser without downloads, and calls only the local Python dictionary importer. It checks 73 ordered occurrences, title and artist suggestions with source headers preserved, local dictionary and Pinyin, AI proposal review with simulated responses, audio handoff and split insertion, Song structure, undo, JSON reopen, and TypeScript export. Disposable results go to `output/playwright/import-workflow/`. It leaves the running development server and your browser project alone.

Name future test commands after their concrete scenario or workflow; avoid vague names such as `test:raw`.

The dictionary sidebar looks up the selected word on demand through the local Python service using `public/cedict_1_0_ts_utf-8_mdbg.txt`. Results are cached in memory (up to 200 words), separately from editable Pinyin/glosses. Dictionary definitions are never saved in project JSON or renderer TypeScript; older JSON references are discarded on load. This works for legacy TS songs as well as raw imports, with no API credentials or external dictionary requests. Restart `npm run workbench` after updating server routes. Removal uses an in-app confirmation, with Undo available.

### Repeats and chorus groups

The Lyric editor's **Add lyric** inserts new shared text. Existing lyrics can be repeated only in **Timing → Repeat**; each repeat starts at the original’s timestamps (with an expected overlap warning) and shares translations. Move it on the timeline. Untimed originals produce untimed repeats. Use timeline dragging to move a timed lyric.

Use **+ Group** beside Lyrics to start from the selected ungrouped lyric, revealed in the list. If it already belongs to a group, choose a first lyric. Hover previews an inclusive range with First/Last labels; clicking the endpoint locks it. **Adjust range** reopens endpoint selection. Existing groups cannot be crossed. Enter a name (initially empty) and choose Create; Cancel/Escape leaves the original selection unchanged. A group must have at least two members. Membership stays fixed; **Ungroup** retains its lyrics, while **Delete group** confirms removal of its appearances. The sidebar's **…** menu also offers Rename and Duplicate. Group headers aggregate warnings even when collapsed.

Click a group's arrow/name to collapse it. Choose a member to emphasize its group. Sidebar rows do not drag: move the passage with its timeline rail handle, or move/trim an individual block.

Choose **Duplicate…**, position the ghost with its own handle, edit the name and click **Create copy**. Dragging only previews the copy; Cancel/Escape discards it. Playback pauses and other edits are inactive while passive timeline panning remains available. Overlap warnings do not prevent confirmation. Each committed move/copy is one Undo operation.

The [grouping contract](../agent-docs/react-workbench/features/lyrics-grouping/SPEC.md) defines ordering, membership, warnings, duplication and persistence.

Run `npm run workbench:test:lyrics-grouping` for the dedicated spec acceptance scenario. Its implementation is `web/tests/lyrics-grouping.ts`; disposable screenshots and results go to `output/playwright/lyrics-grouping/` and are covered by `npm run workbench:clean`. It uses the existing installed browser and a temporary local server, without modifying the running development server or your browser project.

Timeline rows stay fixed during a drag and compact after a drop. Selection reveals the block in both axes; view layout is not saved in project files. Detailed layout behavior and executable checks are linked from the grouping contract.

## Automatic timing and review

Choose local audio and a cached Whisper model, then **Generate timings**. With Local Whisper selected, import a matching word-timestamp JSON under **Advanced** when needed. After generation, **Detected from audio** stays visible in Timing whenever passages are available. **Regenerate timing…** beside **Timing settings** toggles the generation controls. Generation starts from inside that panel. Regular suggestions populate the existing timeline atomically as Needs review. Preserve-reviewed is the default; replace-all requires confirmation. Missing results never erase current bounds. Weak estimates remain in the occurrence inspector until **Use estimate anyway**. Imported transcript provenance is unverified.

Use **Play lyric** to audition the padded interval, adjust boundaries and **Mark reviewed**. Auto-advance wraps through timed rows needing review; disable it in the Timing settings button. The settings panel also holds zoom, snap, linked edges and independent 0–5000 ms padding. Defaults are 250 ms before/after and auto-advance on. **Use latest automatic suggestion** remains separate from reviewed-first Reset. Bulk review is a secondary sidebar selection mode with explicit approval.

Open **Detected from audio** to listen to and add passages individually. **Add to lyrics** leaves you in the list. **View lyric** reveals the newly added occurrence. **Dismiss** or **Clear detected passages** removes pending candidates from the saved project and supports Undo. Outstanding candidates, weak estimates, review/reset snapshots, run identity and settings survive JSON/browser recovery; relink audio and **Check linked audio** before reusing pending data, or explicitly allow reuse with a different/unchecked recording. The normalized SHA-256 audio identity does not authenticate an independently imported transcript. Project JSON stores neither audio nor full transcripts. Legacy TS remains unchanged and does not carry the new review metadata.

Local Whisper is the default. With GROQ_API_KEY configured, select Groq in Automatic timing and choose Large V3 Turbo or Large V3. Generate timings sends normalized mono WAV audio to Groq and uses returned Mandarin word timestamps for local lyric alignment. Recordings up to the existing eight-minute limit fit in one request. Identity checks and imported transcripts run locally. Temporary audio inputs are removed after generation. Use existing cached weights; no downloads run automatically. Compressed audio/video requires a working local FFmpeg decoder. This machine's bundled Remotion decoder is incompatible with its macOS version; a mono 16kHz PCM WAV works for generation without FFmpeg. Playback/waveform availability remains independent.

Run `node web/tests/browser.ts --timing-review` for deterministic review/generation and native WAV replay coverage. Add `--capture-timing-ux` to save review screenshots under `out/workbench/timing-ux/`. [Automatic Timing & Review](../agent-docs/react-workbench/features/automatic-timing-review/SPEC.md#16-implementation-and-verification-record) records all checks and limitations. The [evaluation record](../agent-docs/react-workbench/ASSISTED_TIMING.md) retains listening evidence; automated recognition counts do not certify acoustic accuracy.

### Translation providers

Set either credential in `python-src/.env` or the repository-root `.env` file. Both providers use the same loader.

```dotenv
GROQ_API_KEY=
GEMINI_API_KEY=
```

New projects prefer Groq Qwen when configured. Choose Groq or Gemini and the model in the editor. Previously saved Gemini settings continue to select Gemini. Groq models are allowlisted against the published free-plan limits in `python-src/workbench/translation_providers.py`. Review that list when Groq updates its catalog. GPT-OSS uses structured schema output when enabled. Cached input tokens appear in run details when the API reports them. Percent complete counts validated vocabulary, English and Polish drafts requested in this run. Canceling preserves received drafts.

Groq access failures show the HTTP status and recognized API or gateway reason in the translation status. For authentication failures, the worker uses the exported process credential first, then the Python configuration file, then the repository configuration file. Restart the workbench from the intended environment after changing an exported key.
