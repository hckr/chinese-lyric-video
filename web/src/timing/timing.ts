import {
  projectSchema,
  type History,
  type Occurrence,
  type Project,
  type Snapshot,
} from "../domain.ts";

export type Boundary = "start" | "end" | "both";
export type Snap = "off" | "edges";
export const mediaMs = (seconds: number): number => Math.round(seconds * 1000);
export function formatTime(ms: number | null): string {
  if (ms === null) return "Unassigned";
  const value = Math.max(0, Math.round(ms));
  return `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, "0")}.${String(value % 1000).padStart(3, "0")}`;
}
export function withTimingBaseline(project: Project): Project {
  return projectSchema.parse(project);
}
export const validTiming = (
  o: Pick<Occurrence, "startMs" | "endMs">,
  duration?: number,
): boolean =>
  o.startMs !== null &&
  o.endMs !== null &&
  o.endMs > o.startMs &&
  Number.isSafeInteger(o.startMs) &&
  Number.isSafeInteger(o.endMs) &&
  o.startMs >= 0 &&
  (duration === undefined || o.endMs <= duration);
export function timingStatus(
  o: Occurrence,
  duration?: number,
): "Untimed" | "Reviewed" | "Needs review" {
  return !validTiming(o, duration)
    ? "Untimed"
    : o.timingReview === "reviewed"
      ? "Reviewed"
      : "Needs review";
}
export function reviewTiming(
  project: Project,
  ids: Set<string>,
  reviewed: boolean,
  duration?: number,
): Project {
  return {
    ...project,
    occurrences: project.occurrences.map((o) => {
      if (!ids.has(o.id) || !validTiming(o, duration)) return o;
      return {
        ...o,
        timingReview: reviewed ? "reviewed" : "needs-review",
        ...(reviewed
          ? { reviewedTiming: { startMs: o.startMs!, endMs: o.endMs! } }
          : {}),
      };
    }),
  };
}
export function nextUnreviewed(
  ordered: Occurrence[],
  id: string,
  duration?: number,
): string | undefined {
  const at = ordered.findIndex((o) => o.id === id);
  for (let step = 1; step <= ordered.length; step++) {
    const o = ordered[(at + step) % ordered.length];
    if (
      o.id !== id &&
      validTiming(o, duration) &&
      o.timingReview !== "reviewed"
    )
      return o.id;
  }
}
export function latestAutomatic(
  project: Project,
  id: string,
  duration?: number,
): Project {
  const o = project.occurrences.find((o) => o.id === id);
  if (!o?.automaticTiming) throw Error("No automatic suggestion available.");
  const next = editTiming(project, id, o.automaticTiming, duration);
  return {
    ...next,
    occurrences: next.occurrences.map((o) =>
      o.id === id ? { ...o, timingReview: "needs-review" } : o,
    ),
  };
}

export function timingError(
  cue: Occurrence,
  durationMs?: number,
): string | null {
  for (const ms of [cue.startMs, cue.endMs]) {
    if (ms !== null && (!Number.isSafeInteger(ms) || ms < 0))
      return "Use nonnegative integer milliseconds.";
    if (ms !== null && durationMs !== undefined && ms > durationMs)
      return "Timing exceeds the loaded audio duration.";
  }
  if (cue.startMs !== null && cue.endMs !== null && cue.endMs <= cue.startMs)
    return "End must be later than start.";
  return null;
}
export function editTiming(
  project: Project,
  id: string,
  patch: Partial<Pick<Occurrence, "startMs" | "endMs">>,
  durationMs?: number,
): Project {
  const original = project.occurrences.find((o) => o.id === id);
  if (!original) throw Error("Occurrence not found.");
  const updated = {
    ...original,
    ...(patch.startMs !== undefined ? { startMs: patch.startMs } : {}),
    ...(patch.endMs !== undefined ? { endMs: patch.endMs } : {}),
  };
  const error = timingError(updated, durationMs);
  if (error) throw Error(error);
  if (original.startMs === updated.startMs && original.endMs === updated.endMs)
    return project;
  return {
    ...project,
    occurrences: project.occurrences.map((o) =>
      o.id === id ? { ...updated, timingReview: "needs-review" } : o,
    ),
  };
}
export function resetTiming(
  project: Project,
  id: string,
  durationMs?: number,
): Project {
  const cue = project.occurrences.find((o) => o.id === id);
  const target = cue?.reviewedTiming ?? cue?.automaticTiming;
  if (!target)
    throw Error("No reset reference is available for this occurrence.");
  if (!validTiming(target, durationMs))
    throw Error("The reset reference is outside the loaded audio.");
  return {
    ...project,
    occurrences: project.occurrences.map((o) =>
      o.id === id
        ? {
            ...o,
            startMs: target.startMs,
            endMs: target.endMs,
            timingReview: cue?.reviewedTiming ? "reviewed" : "needs-review",
          }
        : o,
    ),
  };
}

export function snappedTime(
  ms: number,
  snap: Snap,
  others: Occurrence[],
  thresholdMs = 100,
): number {
  if (snap === "edges") {
    const edges = others
      .flatMap((o) => [o.startMs, o.endMs])
      .filter((v): v is number => v !== null);
    const nearest = edges.sort(
      (a, b) => Math.abs(a - ms) - Math.abs(b - ms),
    )[0];
    if (nearest !== undefined && Math.abs(nearest - ms) <= thresholdMs)
      return nearest;
  }
  return Math.round(ms);
}
export function moveTiming(
  cue: Occurrence,
  deltaMs: number,
  boundary: Boundary,
  durationMs?: number,
  snap: Snap = "off",
  others: Occurrence[] = [],
  constrainNeighbors = true,
): Occurrence {
  if (cue.startMs === null || cue.endMs === null || cue.endMs <= cue.startMs)
    throw Error("Assign a valid start and end first.");
  const limit = durationMs ?? Number.MAX_SAFE_INTEGER;
  const validOthers = (constrainNeighbors ? others : []).filter(
    (o) =>
      o.id !== cue.id &&
      o.startMs !== null &&
      o.endMs !== null &&
      o.endMs > o.startMs,
  );
  const lower = Math.max(
    0,
    ...validOthers
      .filter((o) => o.startMs! < cue.startMs!)
      .map((o) => o.endMs!),
  );
  const upper = Math.min(
    limit,
    ...validOthers
      .filter((o) => o.startMs! >= cue.startMs!)
      .map((o) => o.startMs!),
  );
  let { startMs, endMs } = cue;
  if (boundary === "both") {
    const length = endMs - startMs;
    if (length > upper - lower)
      throw Error(
        "Not enough space between neighboring cues. Use exact fields to resolve timing conflicts.",
      );
    startMs = Math.min(
      Math.max(lower, snappedTime(startMs + deltaMs, snap, others)),
      upper - length,
    );
    endMs = startMs + length;
  } else if (boundary === "start") {
    if (endMs > upper)
      throw Error(
        "Correct the end beyond the neighboring cue or audio boundary first.",
      );
    startMs = Math.min(
      endMs - 1,
      Math.max(lower, snappedTime(startMs + deltaMs, snap, others)),
    );
  } else {
    if (startMs >= upper)
      throw Error(
        "Correct the start beyond the neighboring cue or audio boundary first.",
      );
    endMs = Math.min(
      upper,
      Math.max(startMs + 1, snappedTime(endMs + deltaMs, snap, others)),
    );
  }
  return { ...cue, startMs, endMs };
}
export function activeLyrics(
  cues: Occurrence[],
  positionMs: number,
): Occurrence[] {
  return cues.filter(
    (o) =>
      o.startMs !== null &&
      o.endMs !== null &&
      o.startMs <= positionMs &&
      positionMs < o.endMs,
  );
}

/** Only an unambiguous, exactly touching pair can share an edge edit. */
export function moveProjectTiming(
  project: Project,
  id: string,
  deltaMs: number,
  boundary: Boundary,
  durationMs?: number,
  snap: Snap = "off",
  linkEdges = false,
): Project {
  const cue = project.occurrences.find((o) => o.id === id);
  if (!cue) throw Error("Occurrence not found.");
  const valid = project.occurrences.filter(
    (o) => o.startMs !== null && o.endMs !== null && o.endMs > o.startMs,
  );
  const time = boundary === "start" ? cue.startMs : cue.endMs;
  const left = valid.filter((o) => o.endMs === time);
  const right = valid.filter((o) => o.startMs === time);
  if (
    linkEdges &&
    boundary !== "both" &&
    valid.includes(cue) &&
    left.length === 1 &&
    right.length === 1 &&
    (boundary === "start" ? right[0] === cue : left[0] === cue)
  ) {
    const others = project.occurrences.filter(
      (o) => o !== left[0] && o !== right[0],
    );
    const lower = left[0].startMs! + 1;
    const upper = Math.min(
      right[0].endMs! - 1,
      durationMs ?? Number.MAX_SAFE_INTEGER,
    );
    if (lower > upper)
      throw Error("Not enough room to move the shared boundary.");
    const edge = Math.max(
      lower,
      Math.min(upper, snappedTime(time! + deltaMs, snap, others)),
    );
    return editTiming(
      editTiming(project, left[0].id, { endMs: edge }, durationMs),
      right[0].id,
      { startMs: edge },
      durationMs,
    );
  }
  return editTiming(
    project,
    id,
    moveTiming(
      cue,
      deltaMs,
      boundary,
      durationMs,
      snap,
      project.occurrences.filter((o) => o.id !== id),
      false,
    ),
    durationMs,
  );
}

export function timingNotices(
  cues: Occurrence[],
  index: number,
  durationMs?: number,
): string[] {
  const cue = cues[index];
  if (!cue) return [];
  const notices: string[] = [];
  if (cue.startMs === null || cue.endMs === null)
    notices.push("Unassigned timing");
  const error = timingError(cue, durationMs);
  if (error) notices.push(error);
  if (
    cue.startMs !== null &&
    cue.endMs !== null &&
    cues.some(
      (o) =>
        o.id !== cue.id &&
        o.startMs !== null &&
        o.endMs !== null &&
        o.endMs > o.startMs! &&
        cue.startMs! < o.endMs! &&
        cue.endMs! > o.startMs!,
    )
  )
    notices.push("Warning: overlap");
  return notices;
}
// Greedy lanes preserve visible overlaps without reordering the exported data.
export function cueLanes(cues: Occurrence[]): Map<string, number> {
  const lanes: number[] = [],
    result = new Map<string, number>();
  for (const cue of [...cues].sort(
    (a, b) => (a.startMs ?? Infinity) - (b.startMs ?? Infinity),
  )) {
    if (cue.startMs === null || cue.endMs === null || cue.endMs <= cue.startMs)
      continue;
    let lane = lanes.findIndex((end) => end <= cue.startMs!);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = cue.endMs;
    result.set(cue.id, lane);
  }
  return result;
}

// Media selection is session state, independent of undoable lyric/timing edits.
// Keep saved metadata consistent with the loaded file across undo and redo.
export function attachAudioMetadata(
  history: History,
  audio: NonNullable<Project["audio"]>,
): History {
  const update = (snapshot: Snapshot): Snapshot => ({
    ...snapshot,
    project: { ...snapshot.project, audio },
  });
  return {
    present: update(history.present),
    past: history.past.map(update),
    future: history.future.map(update),
  };
}

export function followPlayhead(
  x: number,
  left: number,
  width: number,
  contentWidth: number,
): number {
  if (x >= left && x <= left + (width * 15) / 16) return left;
  return Math.max(0, Math.min(contentWidth - width, x - width / 16));
}

// Regular 1/2/5 intervals keep labels readable at every timeline scale.
export function rulerMarks(
  durationMs: number,
  width: number,
  {
    spacing = 64,
    endLabel = true,
  }: { spacing?: number; endLabel?: boolean } = {},
): { major: number[]; minor: number[] } {
  if (
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    !Number.isFinite(width) ||
    width <= 0 ||
    spacing <= 0
  )
    return { major: [], minor: [] };
  const desired =
    durationMs / Math.max(1, Math.min(1500, Math.floor(width / spacing)));
  const magnitude = 10 ** Math.floor(Math.log10(desired));
  const step = Math.max(
    1,
    [1, 2, 2.5, 5, 10]
      .map((value) => value * magnitude)
      .find((value) => value >= desired)!,
  );
  const ticks: number[] = [];
  for (let time = 0; time < durationMs; time += step) ticks.push(time);
  while (ticks.length > 1) {
    const lastTick = ticks[ticks.length - 1];
    // The timeline needs room for two facing labels. The seek ruler only
    // needs room for the last regular label at the ruler's 12px font size.
    const requiredWidth = endLabel
      ? 2 * spacing
      : 8 * formatRulerTime(lastTick).length + 5;
    const gap = ((durationMs - lastTick) / durationMs) * width;
    if (gap >= requiredWidth) break;
    ticks.pop();
  }
  if (endLabel) {
    ticks.push(durationMs);
    const minor = ticks.slice(1).flatMap((end, index) => {
      const start = ticks[index];
      return [1, 2, 3].map((part) => start + ((end - start) * part) / 4);
    });
    return { major: ticks, minor };
  }
  const major = new Set(ticks);
  const minor: number[] = [];
  for (let time = step / 4; time < durationMs; time += step / 4) {
    if (!major.has(time)) minor.push(time);
  }
  return { major: ticks, minor };
}

export function formatRulerTime(ms: number): string {
  return formatTime(ms)
    .replace(/\.000$/u, "")
    .replace(/(\.\d*?[1-9])0+$/u, "$1");
}
