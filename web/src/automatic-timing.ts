import { z } from "zod";
import {
  projectSchema,
  phraseSchema,
  occurrenceSchema,
  type Project,
  type Word,
  newId,
} from "./domain.ts";
import { editTiming, timingError } from "./timing.ts";

const lineSchema = z.object({
  id: z.string(),
  text: z.string(),
  observedStartMs: z.number().int().nonnegative().optional(),
  observedEndMs: z.number().int().nonnegative().optional(),
  reasons: z.array(z.string()),
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
        weakTiming: line.weakEstimate
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
        startMs: a.occurrence.startMs!,
        endMs: a.occurrence.endMs!,
      })),
    },
  });
}
export function useWeakEstimate(
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
  if (timingError({ ...candidate, phraseId: "candidate" }, duration))
    throw Error("Invalid candidate timing.");
  const existing = project.phrases.find((p) => p.lyricKey === candidate.text);
  const phrase = existing ?? {
    id: crypto.randomUUID(),
    lyricKey: candidate.text,
    translation: { en: "", pl: "" },
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
  occurrences.splice(index < 0 ? occurrences.length : index, 0, cue);
  return {
    ...project,
    phrases: existing ? project.phrases : [...project.phrases, phrase],
    occurrences,
    timingRun: {
      ...project.timingRun!,
      candidates: project.timingRun!.candidates.filter((c) => c.id !== id),
    },
  };
}
