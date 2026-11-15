# Future experiment — automatic lyric alignment and timing proposals

Status: **proposed experiment, not implemented** or required for checkpoint B. Scheduling and dependencies are tracked in [the roadmap](../ROADMAP.md). Check any API-bridge dependencies before committing to an implementation sequence; this is not approval to install models or execute inference. A prior Whisper attempt had poor results. The objective remains to reduce repetitive manual timing for a song whose lyrics are already supplied.

## Working hypothesis

Compare expected and recognized **Pinyin syllable sequences without tones**, rather than requiring recognized Hanzi to match the supplied text. This might recover useful alignment when recognized characters differ but pronunciation is close. It does not solve singing recognition, syllable boundaries or timestamp errors by itself; the experiment must establish whether it helps. Removing tones also discards distinctions, so improved recall may trade off against false matches.

Separate two tasks:

- **Known-lyrics alignment (first):** supplied text/Pinyin is authoritative; estimate where each ordered lyric appearance occurs in the selected audio.
- **Unknown-lyrics detection/transcription (later):** discover text when no lyrics are supplied. Treat recognition as a draft requiring correction before alignment, not a source of verified lyrics or translations.

## First experimental workflow

1. Use the selected local soundtrack and the full ordered lyric sequence, expanding repeated phrases into independent appearances. Prefer reviewed Pinyin already in the project. If pronunciation is missing or ambiguous, use the existing Python dictionary/NLP layer to propose candidates for review; do not silently derive replacements for manual readings.
2. Produce timestamped acoustic/transcription observations. First audit reusable local code and available models; choose a small explicit experiment rather than adding a large stack. A Whisper-like transcript can be one observation source to compare with another alignment approach. Do not assume a model is suitable because it works on speech.
3. Parse readings into syllables before removing tone marks. Preserve ü versus u and pronunciation distinctions; remove only tone accents/numbers, retaining unmarked neutral syllables. Apostrophes may separate syllables but are not word records. For example, a comparison representation could be `nǚ'ér` → `[nü, er]`, `piàoliang` → `[piao, liang]`. Ambiguous parses stay unresolved. The stored tone-marked, contiguous per-word Pinyin and approved word segmentation remain unchanged.
4. Align expected and observed syllable sequences in order with explicit insertion/deletion/substitution costs and candidate pronunciation alternatives. Investigate weighted approximate matching and time-constrained sequence alignment; keep exact tone-free matching as a baseline. Missing/extra sung syllables, ad-libs and pauses must be allowed without shifting every later lyric.
5. Support manual time anchors and restrict re-alignment to a selected region. Repeated choruses must retain their ordered identities instead of all matching the first similar passage. Evaluate instrumental breaks, intro/outro, held notes, fast passages, tempo changes and mixed-language lines explicitly. Never fabricate precise boundaries by evenly distributing words across a coarse chunk without identifying them as low-confidence estimates.
6. Return proposed integer-millisecond start/end times keyed by stable appearance ID, plus confidence/reasons, unresolved regions, source/model/version and parameters. Display proposals beside the current timings. Let the user audition, adjust, accept/reject individual cues or a selected range, and undo acceptance as a batch. Uncertain items remain pending.
7. Preserve existing timestamps until explicit acceptance. Validate accepted proposals against the [timing contract](TIMING_EDITOR.md): enforce duration/bounds, allow overlaps with non-blocking warnings. Do not replace lyric text, translations, manual Pinyin, approved segmentation, IDs, repetition order or the original-timing reset baseline.

## Boundaries

Reuse Python for pronunciation/NLP and any audio/model orchestration rather than duplicating that logic in React. Keep model-specific data outside the established legacy song contract. Decide whether proposal/provenance fields require a project-schema extension when the experiment becomes implementation work.

Local processing is preferred. Selecting audio or editing lyrics must never trigger inference, downloads, uploads or paid requests. Disclose and approve any required model/dependency download or external processing before using it. The current experiment plan does not authorize those actions or select a provider. Manual timing and file export remain available if alignment fails or is canceled. Source audio, source song modules and committed edits are never overwritten by experimentation.

## Evaluation and decision gate

Compare at least these baselines on the same annotated samples: manual timing, character-based recognition matching, exact tone-free syllable matching, and the proposed approximate/anchor-assisted alignment. If available, compare a direct known-lyrics alignment approach as well. Include previously tested songs plus the user's new-song workflow; retain a held-out song so tuning to Macchiato is not mistaken for general success.

Record line-boundary error distributions and large outliers, missing/extra matches, repeated-section mistakes, overlap/duration violations, and confidence versus actual error. Define useful error tolerances with the user before calling the feature accurate. Measure correction time and number of manual actions against doing the song by hand, as well as processing time, memory, downloads and any request/token/cost usage.

Proceed only if the proposals measurably reduce manual correction work and expose failures clearly. A low-confidence suggestion can still help, but a plausible-looking wrong timestamp must not be marked verified. Add offline normalization/alignment fixtures, repeated-section tests, cancellation/recovery tests and explicit-acceptance/undo tests before integrating proposals into the editor. New-song manual listening remains part of the gate.
