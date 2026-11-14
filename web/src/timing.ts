import type { History, Occurrence, Project, Snapshot } from "./domain.ts";

export type Boundary = "start" | "end" | "both";
export type Snap = "off" | "edges";
export const mediaMs = (seconds: number): number => Math.round(seconds * 1000);
export function formatTime(ms: number | null): string {
  if (ms === null) return "Unassigned";
  const value = Math.max(0, Math.round(ms));
  return `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, "0")}.${String(value % 1000).padStart(3, "0")}`;
}
export function withTimingBaseline(project: Project): Project {
  return project.timingBaseline
    ? project
    : {
        ...project,
        timingBaseline: project.occurrences.map((o) => ({ ...o })),
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
  const updated = { ...original, ...patch };
  const error = timingError(updated, durationMs);
  if (error) throw Error(error);
  if (original.startMs === updated.startMs && original.endMs === updated.endMs)
    return project;
  return {
    ...withTimingBaseline(project),
    occurrences: project.occurrences.map((o) => (o.id === id ? updated : o)),
  };
}
export function resetTiming(project: Project, id: string): Project {
  const original = project.timingBaseline?.find((o) => o.id === id);
  if (!original)
    throw Error("No original timing is available for this occurrence.");
  return {
    ...project,
    occurrences: project.occurrences.map((o) =>
      o.id === id ? { ...original } : o,
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
export function rulerTicks(
  durationMs: number,
  width: number,
  spacing = 64,
): number[] {
  if (
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    !Number.isFinite(width) ||
    width <= 0 ||
    spacing <= 0
  )
    return [];
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
  if (
    ticks.length > 1 &&
    ((durationMs - ticks[ticks.length - 1]) / durationMs) * width < spacing
  )
    ticks.pop();
  ticks.push(durationMs);
  return ticks;
}

export function formatRulerTime(ms: number): string {
  return formatTime(ms)
    .replace(/\.000$/u, "")
    .replace(/(\.\d*?[1-9])0+$/u, "$1");
}
