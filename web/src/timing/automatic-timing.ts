import {
  englishLyric,
  lyricCount,
  lyricLimit,
  validPieces,
} from "../lyric-length.ts";
import { z } from "zod";
import {
  projectSchema,
  timedWordsSchema,
  phraseSchema,
  occurrenceSchema,
  type Project,
  type Word,
  newId,
} from "../domain.ts";
import { editTiming, timingError } from "./timing.ts";

const lineSchema = z.object({
  id: z.string(),
  text: z.string(),
  observedStartMs: z.number().int().nonnegative().optional(),
  observedEndMs: z.number().int().nonnegative().optional(),
  reasons: z.array(z.string()),
  refinementEvidence: z.boolean().optional(),
  matched: z.number().int().nonnegative().optional(),
  total: z.number().int().nonnegative().optional(),
  weakEstimate: z
    .object({
      startMs: z.number().int().nonnegative(),
      endMs: z.number().int().nonnegative(),
    })
    .optional(),
});
export const timingResultSchema = z.object({
  lines: z.array(lineSchema),
  additions: z
    .array(
      z.object({
        phrase: phraseSchema,
        timedWords: timedWordsSchema.optional(),
        occurrence: occurrenceSchema,
      }),
    )
    .default([]),
});
export type TimingResult = z.infer<typeof timingResultSchema>;

export function validateTimingResult(
  raw: unknown,
  project: Project,
  ids: string[],
  duration: number,
): TimingResult {
  const result = timingResultSchema.parse(raw);
  if (
    result.lines.length !== ids.length ||
    result.lines.some((line, i) => line.id !== ids[i])
  )
    throw Error("Timing result does not match the requested lyrics.");
  for (const line of result.lines) {
    const cue = project.occurrences.find((o) => o.id === line.id)!;
    if (
      project.phrases.find((p) => p.id === cue.phraseId)?.lyricKey !== line.text
    )
      throw Error("Timing result text has changed.");
    if (
      line.weakEstimate &&
      (line.observedStartMs !== undefined ||
        timingError({ ...cue, ...line.weakEstimate }, duration))
    )
      throw Error("Invalid weak timing estimate.");
    if (
      (line.observedStartMs === undefined) !==
      (line.observedEndMs === undefined)
    )
      throw Error("Incomplete timing suggestion.");
    if (
      line.observedStartMs !== undefined &&
      timingError(
        { ...cue, startMs: line.observedStartMs, endMs: line.observedEndMs! },
        duration,
      )
    )
      throw Error("Invalid timing suggestion.");
  }
  const additionIds = new Set<string>();
  for (const a of result.additions) {
    if (
      project.occurrences.some((o) => o.id === a.occurrence.id) ||
      additionIds.has(a.occurrence.id) ||
      a.occurrence.phraseId !== a.phrase.id ||
      a.occurrence.detectedFromAudio !== true ||
      a.occurrence.startMs === null ||
      a.occurrence.endMs === null ||
      timingError(a.occurrence, duration)
    )
      throw Error("Invalid detected passage.");
    additionIds.add(a.occurrence.id);
  }
  return result;
}

export function acceptTiming(
  project: Project,
  result: TimingResult,
  ids: Set<string>,
  additionIds: Set<string>,
  duration: number,
  weakIds: Set<string> = new Set(),
): Project {
  let next = project;
  const applied = new Set<string>();
  for (const line of result.lines) {
    if (!ids.has(line.id)) continue;
    const bounds =
      line.observedStartMs !== undefined && line.observedEndMs !== undefined
        ? { startMs: line.observedStartMs, endMs: line.observedEndMs }
        : weakIds.has(line.id)
          ? line.weakEstimate
          : undefined;
    if (!bounds) continue;
    next = editTiming(next, line.id, bounds, duration);
    next = {
      ...next,
      occurrences: next.occurrences.map((o) =>
        o.id === line.id
          ? {
              ...o,
              timingReview: "needs-review",
              automaticTiming: {
                ...bounds,
                runId: "manual-accept",
                reasons: line.reasons,
              },
            }
          : o,
      ),
    };
    applied.add(line.id);
  }
  const occurrences = [...next.occurrences],
    phrases = [...next.phrases];
  for (const a of result.additions) {
    if (
      !additionIds.has(a.occurrence.id) ||
      occurrences.some((o) => o.id === a.occurrence.id)
    )
      continue;
    if (lyricCount(a.phrase.lyricKey) > lyricLimit)
      throw Error("Review splits before adding this passage.");
    const shared = phrases.find((p) => p.lyricKey === a.phrase.lyricKey);
    if (!shared)
      phrases.push({
        ...a.phrase,
        review: "pending",
        segmentationApproved: false,
      });
    const cue = {
      ...a.occurrence,
      timingReview: "needs-review" as const,
      automaticTiming: {
        startMs: a.occurrence.startMs!,
        endMs: a.occurrence.endMs!,
        runId: "manual-accept",
        reasons: [],
      },
      phraseId: shared?.id ?? a.phrase.id,
    };
    const index = occurrences.findIndex(
      (o) => o.startMs !== null && o.startMs > cue.startMs!,
    );
    occurrences.splice(index < 0 ? occurrences.length : index, 0, cue);
    applied.add(cue.id);
  }
  if (!applied.size) return project;
  return projectSchema.parse({
    ...next,
    phrases,
    occurrences,
  });
}

export function formatTimingEta(deadline: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return `ETA ~${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function englishRetryIds(project: Project): string[] {
  const phrases = new Map(project.phrases.map((p) => [p.id, p.lyricKey]));
  return project.occurrences
    .filter(
      (o) =>
        o.startMs === null &&
        o.endMs === null &&
        /[a-z]/iu.test(phrases.get(o.phraseId) ?? ""),
    )
    .map((o) => o.id);
}

export function applyEnglishRetry(
  project: Project,
  raw: unknown,
  duration: number,
  provider: "local" | "groq",
  model: string,
): Project {
  const runId = project.timingRun?.id;
  if (!runId) return project;
  const result = validateTimingResult(
    raw,
    project,
    project.occurrences.map((o) => o.id),
    duration,
  );
  const eligible = new Set(englishRetryIds(project));
  const proposals = new Map(result.lines.map((line) => [line.id, line]));
  const bounded = result.lines.filter(
    (line) =>
      eligible.has(line.id) &&
      line.observedStartMs !== undefined &&
      line.observedEndMs !== undefined,
  );
  const overlaps = new Set<string>();
  for (let i = 1; i < bounded.length; i++) {
    if (bounded[i - 1].observedEndMs! > bounded[i].observedStartMs!) {
      overlaps.add(bounded[i - 1].id);
      overlaps.add(bounded[i].id);
    }
  }
  let changed = false;
  const occurrences = project.occurrences.map((o, index, rows) => {
    const proposal = proposals.get(o.id);
    const startMs =
      proposal?.observedStartMs ?? proposal?.weakEstimate?.startMs;
    const endMs = proposal?.observedEndMs ?? proposal?.weakEstimate?.endMs;
    if (
      !eligible.has(o.id) ||
      overlaps.has(o.id) ||
      !proposal ||
      startMs === undefined ||
      endMs === undefined
    )
      return o;
    const previous = rows
      .slice(0, index)
      .reverse()
      .find((row) => row.startMs !== null || row.endMs !== null);
    const following = rows
      .slice(index + 1)
      .find((row) => row.startMs !== null || row.endMs !== null);
    if (
      (previous && (previous.endMs === null || startMs < previous.endMs)) ||
      (following && (following.startMs === null || endMs > following.startMs))
    )
      return o;
    const suggestion = {
      startMs,
      endMs,
      runId,
      language: "en" as const,
      provider,
      model,
      reasons: proposal.reasons,
      matched: proposal.matched,
      total: proposal.total,
    };
    if (proposal.weakEstimate) {
      if (proposal.matched === 0) return o;
      if (
        o.weakTiming &&
        (o.weakTiming.matched ?? 0) >= (proposal.matched ?? 0)
      )
        return o;
      changed = true;
      return { ...o, weakTiming: suggestion, timingIssue: suggestion };
    }
    changed = true;
    return {
      ...o,
      startMs,
      endMs,
      timingReview: "needs-review" as const,
      weakTiming: undefined,
      timingIssue: undefined,
      automaticTiming: suggestion,
    };
  });
  return changed ? projectSchema.parse({ ...project, occurrences }) : project;
}

export type GenerationPolicy = "preserve-reviewed" | "replace-all";
export function applyGeneration(
  project: Project,
  raw: unknown,
  duration: number,
  policy: GenerationPolicy,
  run: Omit<NonNullable<Project["timingRun"]>, "candidates">,
): Project {
  const result = validateTimingResult(
    raw,
    project,
    project.occurrences.map((o) => o.id),
    duration,
  );
  const lines = new Map(result.lines.map((l) => [l.id, l]));
  return projectSchema.parse({
    ...project,
    occurrences: project.occurrences.map((o) => {
      const line = lines.get(o.id)!;
      const context = {
        runId: run.id,
        reasons: line.reasons,
        ...(line.matched !== undefined ? { matched: line.matched } : {}),
        ...(line.total !== undefined ? { total: line.total } : {}),
      };
      if (line.observedStartMs !== undefined) {
        const automaticTiming = {
          startMs: line.observedStartMs,
          endMs: line.observedEndMs!,
          ...context,
        };
        const protectedRow =
          policy === "preserve-reviewed" && o.timingReview === "reviewed";
        const same =
          o.startMs === automaticTiming.startMs &&
          o.endMs === automaticTiming.endMs;
        return {
          ...o,
          automaticTiming,
          weakTiming: undefined,
          timingIssue: undefined,
          ...(!protectedRow
            ? {
                startMs: automaticTiming.startMs,
                endMs: automaticTiming.endMs,
                timingReview:
                  same && o.timingReview === "reviewed"
                    ? "reviewed"
                    : "needs-review",
              }
            : {}),
        };
      }
      return {
        ...o,
        timingIssue: context,
        weakTiming:
          line.weakEstimate && line.matched !== 0
            ? { ...line.weakEstimate, ...context }
            : undefined,
      };
    }),
    timingRun: {
      ...run,
      candidates: result.additions.map((a) => ({
        id: a.occurrence.id,
        text: a.phrase.lyricKey,
        words: a.phrase.words,
        timedWords: a.timedWords,
        startMs: a.occurrence.startMs!,
        endMs: a.occurrence.endMs!,
      })),
    },
  });
}
export function applyWeakEstimate(
  project: Project,
  id: string,
  duration?: number,
): Project {
  const cue = project.occurrences.find((o) => o.id === id);
  if (!cue?.weakTiming) throw Error("No weak estimate available.");
  const next = editTiming(project, id, cue.weakTiming, duration);
  return {
    ...next,
    occurrences: next.occurrences.map((o) =>
      o.id === id
        ? {
            ...o,
            timingReview: "needs-review",
            weakTiming: undefined,
          }
        : o,
    ),
  };
}
const transcriptSchema = z.object({
  segments: z.array(
    z.object({
      words: z.array(
        z
          .object({
            word: z.string(),
            start: z.number().nonnegative(),
            end: z.number().nonnegative(),
          })
          .refine(({ start, end }) => end >= start),
      ),
    }),
  ),
});

export function parseWhisperTranscript(text: string) {
  try {
    return transcriptSchema.parse(JSON.parse(text));
  } catch {
    throw Error(
      "Choose a Whisper JSON file with word timestamps, or clear the transcript.",
    );
  }
}

export function addDetectedCandidate(
  project: Project,
  id: string,
  duration?: number,
  recoveredWords?: Word[],
): Project {
  const candidate = project.timingRun?.candidates.find((c) => c.id === id);
  if (!candidate || project.occurrences.some((o) => o.id === id))
    return project;
  if (lyricCount(candidate.text) > lyricLimit)
    throw Error("Review splits before adding this passage.");
  if (timingError({ ...candidate, phraseId: "candidate" }, duration))
    throw Error("Invalid candidate timing.");
  const existing = project.phrases.find((p) => p.lyricKey === candidate.text);
  const phrase = existing ?? {
    id: crypto.randomUUID(),
    lyricKey: candidate.text,
    translation: {
      en: englishLyric(candidate.text) ? candidate.text : "",
      pl: "",
    },
    words: (candidate.words ?? recoveredWords ?? []).map((word) => ({
      ...word,
      id: newId(),
    })),
    review: "pending" as const,
    segmentationApproved: false,
  };
  const cue = {
    id,
    phraseId: phrase.id,
    startMs: candidate.startMs,
    endMs: candidate.endMs,
    detectedFromAudio: true,
    timingReview: "needs-review" as const,
    automaticTiming: {
      startMs: candidate.startMs,
      endMs: candidate.endMs,
      runId: project.timingRun!.id,
      reasons: [],
    },
  };
  const occurrences = [...project.occurrences];
  const index = occurrences.findIndex(
    (o) => o.startMs !== null && o.startMs > candidate.startMs,
  );
  const previous = occurrences[index - 1];
  const following = occurrences[index];
  const section =
    previous &&
    previous.startMs !== null &&
    previous.startMs <= cue.startMs &&
    following
      ? project.lyricGroups?.find(
          (group) =>
            group.occurrenceIds.includes(previous.id) &&
            group.occurrenceIds.includes(following.id),
        )
      : undefined;
  occurrences.splice(index < 0 ? occurrences.length : index, 0, cue);
  return {
    ...project,
    phrases: existing ? project.phrases : [...project.phrases, phrase],
    occurrences,
    ...(section && {
      lyricGroups: project.lyricGroups!.map((group) =>
        group === section
          ? {
              ...group,
              occurrenceIds: occurrences
                .filter(
                  (o) => o.id === id || group.occurrenceIds.includes(o.id),
                )
                .map((o) => o.id),
            }
          : group,
      ),
    }),
    timingRun: {
      ...project.timingRun!,
      candidates: project.timingRun!.candidates.filter((c) => c.id !== id),
    },
  };
}

export const needsImportSplit = (candidate: { text: string }) =>
  lyricCount(candidate.text) > lyricLimit;

export type Candidate = NonNullable<Project["timingRun"]>["candidates"][number];
export function proposedIntervals(c: Candidate, pieces: string[]) {
  const evidence = c.timedWords;
  const bounds = new Map<number, { endMs: number; startMs: number }>();
  if (evidence?.map((w) => w.text).join("") === c.text) {
    let at = 0;
    evidence.forEach((w, i) => {
      at += w.text.length;
      const next = evidence[i + 1];
      if (next && w.endMs <= next.startMs)
        bounds.set(at, { endMs: w.endMs, startMs: next.startMs });
    });
  }
  let offset = 0;
  return pieces.map((text, i) => {
    const startMs = i === 0 ? c.startMs : bounds.get(offset)?.startMs;
    offset += text.length;
    const endMs = i === pieces.length - 1 ? c.endMs : bounds.get(offset)?.endMs;
    return { text, startMs, endMs };
  });
}
export type ReviewedPiece = {
  text: string;
  startMs: number;
  endMs: number;
  words?: Word[];
};
export function addReviewedPieces(
  project: Project,
  id: string,
  pieces: ReviewedPiece[],
  duration?: number,
): Project {
  const run = project.timingRun,
    c = run?.candidates.find((item) => item.id === id);
  if (
    !run ||
    !c ||
    project.occurrences.some((o) => o.id === id) ||
    !validPieces(
      c.text,
      pieces.map((p) => p.text),
    ) ||
    pieces.some(
      (p, i) =>
        !Number.isSafeInteger(p.startMs) ||
        !Number.isSafeInteger(p.endMs) ||
        p.startMs < (pieces[i - 1]?.endMs ?? c.startMs) ||
        p.endMs <= p.startMs ||
        p.endMs > c.endMs,
    )
  )
    throw Error(
      "Keep all lyric text and choose ordered intervals inside the passage.",
    );
  const replacements = pieces.map((p, i) => ({
    ...p,
    id: i === 0 ? id : newId(),
  }));
  let next: Project = {
    ...project,
    timingRun: {
      ...run,
      candidates: [
        ...run.candidates.filter((item) => item.id !== id),
        ...replacements,
      ],
    },
  };
  for (const item of replacements)
    next = addDetectedCandidate(next, item.id, duration);
  return next;
}
