# Decisions and questions for the local code audit

This document separates what the owner has already decided from what Codex should **discover** rather than invent.

## Settled choices

| Area | Decision | Reason |
|---|---|---|
| UI | React, TypeScript, dark-only, blue `#4EAEF8` | Style flexibility; explicit preference |
| First handoff | `.ts` download and manual placement in existing project | Simplest viable end-to-end path |
| Back end | Preserve/reuse existing Python AI/NLP logic, remove Streamlit only after migration | Avoid duplicating working code |
| Word segmentation | User can merge adjacent lexical words and split a word into two; preserve notes and phrase translations | AI segmentation isn't authoritative; requires manual correction |
| Word Pinyin | One contiguous tone-marked Pinyin value per word (`piàoliang`); display spaces between words | Match manually authored files; avoid per-syllable space artifacts |
| Timing | Edit ordered occurrences, not unique phrases; integer milliseconds | Repeated chorus needs independent times |
| Backgrounds | Footage vs still image + visualizer are distinct modes | Different media and audio behavior |
| Composition reuse | Share actual common behavior, keep mode-specific components and separate thumbnails | Avoid false abstractions |
| Default render | Visual backward compatibility before redesign | Existing videos must stay reproducible |
| Config | Curated presets + grouped settings, not exhaustive knobs | Maintainability |
| Work strategy | Small verified milestones, no destructive modification of uncommitted files | Protect user's work |

## Questions Codex should answer from the local repo

1. Which Remotion compositions and thumbnail variants currently exist (exact IDs, names, file paths)? Which ones are used in production videos?
2. Does the footage composition use embedded video audio? If the image/visualizer version uses a separate track, is there any deliberate dual-source mixing to preserve?
3. Which settings already differ between songs or modes (visualizer colors, bass response, animation, blur, crop, lyric visibility, fonts, intro/outro)? Which are still truly constant?
4. Is the existing Python translation core already independent of Streamlit? What interfaces and tests are present?
5. Which song TS constructs occur across real files beyond the known `TIMELINE`/`LYRICS_DICT`/getter example? Any custom derived fields or side-effectful expressions that require manual import fallback?
6. What are the actual FPS, ratio, duration, gap/overlap conventions, and endMs semantics used in the Remotion renderer?
7. Where do media assets live and how do songs reference them? Which exported paths resolve in browser dev, in Remotion Studio, and during CLI rendering?
8. What is the least invasive path to a shared Remotion composition for actual preview, with no duplicate rendering algorithms?

Codex should record answers in `LOCAL_AUDIT.md` and adjust proposed structures accordingly. Do not block the entire file-based editor waiting for answers relevant only to later render integration.

## Deliberately postponed

- Automatic timing and transcription/alignment
- Word-by-word karaoke timecodes
- Multi-track video editing / audio mixing / advanced effects keyframes
- Changing composition IDs or deleting old entrypoints
- Rebuilding all thumbnails as one generic video composition
- Auto-writing exported files directly into the repository
- Hosting, multiuser server, publication automation
