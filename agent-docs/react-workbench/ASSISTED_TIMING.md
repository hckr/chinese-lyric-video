# Assisted timing — evaluation and safeguards

This records timing experiments and owner feedback, not released application
functionality. [Automatic Timing & Review](features/automatic-timing-review/SPEC.md)
describes the accepted workflow and its verification record. Retained inputs and
reports are indexed in [lyric-timing experiments](../../experiments/lyric-timing/README.md).

## Scope and interpretation

Known-lyrics alignment estimates when supplied, ordered occurrences are sung.
Discovering missing lyrics is a separate operation: recognized text is a candidate,
not permission to replace the supplied lyrics or merge repeated choruses.

The comparisons used character, tone-marked dictionary Pinyin and tone-free Pinyin
baselines. Dictionary alternatives can inflate matches, particularly for polyphones;
these scores are not acoustic confidence or verified timing accuracy. Tone removal
must preserve ü. Shared word timestamps do not establish per-character boundaries.

Authored timestamps may intentionally precede vocals for display. Differences from
those timestamps are not measured vocal-boundary errors. Evaluate acoustic timing
separately from a preferred display lead.

## Macchiato excerpt comparisons

A 35-second sample contained 67 reference units, including an unmatched seven-character
opening title. Segment-only recognition produced:

| Model  | Characters | Tone-marked Pinyin | Tone-free Pinyin |
| ------ | ---------- | ------------------ | ---------------- |
| base   | 27         | 34                 | 43               |
| small  | 49         | 50                 | 54               |
| medium | 59         | 59                 | 59               |
| turbo  | 53         | 53                 | 56               |

Medium had the strongest text coverage on this sample, but combined segments
obscured internal lyric boundaries. Turbo's segment boundaries were more often
line-sized. This does not establish a general model ranking.

With word timestamps, medium matched all 60 sung units; turbo matched 54 with
characters/tone-marked Pinyin and 57 with tone-free Pinyin. Tone-free matching
extended some turbo bounds by recovering differently recognized characters.
Both runs still produced unsupported opening text, and medium included a
zero-duration word: exact recognition alone does not establish reliable timing.
The owner reports vocalizations at the opening, not verified credit text.

## Full Macchiato evaluation

The medium run covered a 184.516-second recording. All three baselines matched
305/305 sung units across 36 appearances; the opening title remained unmatched.
Proposed intervals were positive, within the audio and nonoverlapping, with
repeated sections in their expected order. Word records nevertheless included
zero-duration spans, so these results do not establish karaoke-level precision.

A known-working reproduction configuration was medium, Mandarin, word timestamps,
four CPU threads and `NUMBA_THREADING_LAYER=workqueue`. Model/dependency setup is
manual. See the artifact index for retained inputs and reports rather than using
obsolete temporary paths.

## Owner listening feedback (2026-11-17)

Macchiato timing was mostly right and saved time compared with manual work. This
establishes qualitative usefulness, not a measured correction-effort benchmark.
The existing authored timings mostly represented the owner's preferred display
values; re-entering a complete manual reference table was unnecessary.

Specific feedback: line-02 was late, line-04 slightly late and line-26a early.
A single display lead cannot correct both early and late exceptions. Compare
these cases with audio before changing the alignment policy.

Two deferred ideas remain in [the roadmap](../ROADMAP.md):

- Evaluate waveform-assisted onset refinement without snapping blindly to musical
  transients or overwriting manual corrections.
- Offer an optional hold-until-next-lyric display policy for short gaps, preserving
  instrumental breaks and acoustic boundaries rather than changing them silently.

## Keep Walking held-out evaluation

The 72-occurrence comparison produced 400/459 character matches, 410/459 tone-marked
Pinyin matches and 424/459 tone-free matches. All occurrences had partial matches;
positive, nonoverlapping proposals did not independently prove vocal accuracy.

In eight chorus starts, recognized 铃鱼 corresponded to supplied 淋雨. The owner
judged overall timing acceptable and said those mismatched observed syllables
should contribute to the bounds. First/last exact matches alone could omit useful
leading or trailing observations.

The targeted edge-inclusion comparison advanced those starts by 680–1220 ms and
corrected two preceding endings that had borrowed a following observation. The
owner judged this better. Including the opening English Oh moved its proposed
start from 12.88 to 10.88 seconds; the owner found it a little late but accepted
keeping it. Preserve mixed-language and repeated-section checks when changing
alignment; these listening results do not certify all possible boundaries.

## New-song cat evaluation

The supplied lyrics contained 73 occurrences and 22 unique phrases, without prior
timings. Character/Pinyin/tone-free comparisons matched 356/449, 374/449 and 401/449
units respectively. Ordered assignment proposed 72/73 positive, nonoverlapping
intervals within the recording. The remaining line crossed a long observation
gap and stayed unresolved rather than receiving an invented interval.

The owner approved a review copy with six recognized intro lines missing from the
supplied lyrics. Extra text such as “Zither Harp” remained an unapproved candidate.
This supports explicit candidate inspection/addition, not automatic lyric insertion
or recognition-as-verification. Audio origin and timing review are distinct.

## Safeguards and evaluation gate

- Preserve supplied text, manual readings, translations, segmentation, occurrence
  IDs and repetition order. Changed recognition is not permission to rewrite them.
- Do not interpolate precise timestamps from coarse observations merely to fill
  unresolved rows. Weak estimates stay distinct from normal assignments and need
  the explicit per-occurrence choice in the approved feature specification.
- Protect reviewed snapshots and manual edits, including failed/cancelled/stale
  runs. Follow the approved regeneration/reset policy, not an experimental UI.
- Keep inference local and deliberate; selecting media or opening a workspace must
  not initiate model downloads, installations or paid requests. Manual timing and
  export remain usable without automatic timing.
- Assess held notes, fast/mixed-language passages, missing/extra observations,
  repeated sections, ad-libs and instrumental gaps. Keep failure reasons visible.
- Compare manual correction effort, boundary outliers, repeat identity and resource
  costs on annotated and held-out songs. Recognition coverage is not the acceptance
  criterion; the user must find timing useful while failures remain identifiable.
