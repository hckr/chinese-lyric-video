import { lyricCount, lyricLimit } from "./lyric-length.ts";
import {
  newId,
  parseProject,
  type Occurrence,
  type Project,
} from "./domain.ts";
import {
  editTiming,
  snappedTime,
  timingNotices,
  type Snap,
} from "./timing/timing.ts";

export function createGroup(
  project: Project,
  name: string,
  first: string,
  last: string,
): Project {
  const start = project.occurrences.findIndex((cue) => cue.id === first);
  const end = project.occurrences.findIndex((cue) => cue.id === last);
  if (!name.trim() || start < 0 || end <= start)
    throw Error(
      "Name the group and choose its last lyric after the selected lyric (at least two lyrics).",
    );
  const selected = project.occurrences
    .slice(start, end + 1)
    .map((cue) => cue.id);
  if (
    project.lyricGroups?.some((group) =>
      group.occurrenceIds.some((id) => selected.includes(id)),
    )
  )
    throw Error(
      "These lyrics already belong to a group. Choose ungrouped lyrics.",
    );
  return parseProject(
    JSON.stringify({
      ...project,
      lyricGroups: [
        ...(project.lyricGroups ?? []),
        {
          id: newId(),
          name: name.trim(),
          occurrenceIds: project.occurrences
            .slice(start, end + 1)
            .map((cue) => cue.id),
        },
      ],
    }),
  );
}

export type LyricGroup = NonNullable<Project["lyricGroups"]>[number];
export type GroupUnit = {
  id: string;
  group?: LyricGroup;
  members: Project["occurrences"];
};
export function sidebarUnits(
  project: Project,
  provisionalPositions?: ReadonlyMap<string, { sidebarMs: number }>,
): GroupUnit[] {
  const position = (cue: Occurrence) =>
    cue.startMs ?? provisionalPositions?.get(cue.id)?.sidebarMs ?? Infinity;
  const owners = new Map(
    (project.lyricGroups ?? []).flatMap((g) =>
      g.occurrenceIds.map((id) => [id, g] as const),
    ),
  );
  const emitted = new Set<string>();
  const sort = (items: Project["occurrences"]) =>
    [...items].sort((a, b) => position(a) - position(b));
  const units: GroupUnit[] = [];
  for (const cue of project.occurrences) {
    const group = owners.get(cue.id);
    if (!group) units.push({ id: cue.id, members: [cue] });
    else if (!emitted.has(group.id)) {
      emitted.add(group.id);
      units.push({
        id: group.id,
        group,
        members: sort(
          project.occurrences.filter((o) => group.occurrenceIds.includes(o.id)),
        ),
      });
    }
  }
  return units.sort(
    (a, b) =>
      Math.min(...a.members.map(position)) -
      Math.min(...b.members.map(position)),
  );
}
export function orderGroupedProject(project: Project): Project {
  const occurrences = sidebarUnits(project).flatMap((unit) => unit.members);
  if (occurrences.every((cue, i) => cue === project.occurrences[i]))
    return project;
  return {
    ...project,
    occurrences,
    ...(project.timingBaseline
      ? {
          timingBaseline: occurrences.map(
            (cue) =>
              project.timingBaseline!.find((base) => base.id === cue.id)!,
          ),
        }
      : {}),
  };
}
export function groupRange(members: Project["occurrences"]) {
  const starts = members.flatMap((cue) =>
    cue.startMs === null ? [] : [cue.startMs],
  );
  const ends = members.flatMap((cue) =>
    cue.endMs === null ? [] : [cue.endMs],
  );
  return {
    start: starts.length ? Math.min(...starts) : null,
    end: ends.length ? Math.max(...ends) : null,
  };
}
export function groupWarnings(
  project: Project,
  group: LyricGroup,
  durationMs = project.audio?.durationMs,
): string[] {
  const warnings = new Set(
    group.occurrenceIds.flatMap((id) =>
      timingNotices(
        project.occurrences,
        project.occurrences.findIndex((cue) => cue.id === id),
        durationMs,
      ),
    ),
  );
  const starts = project.occurrences
    .filter(
      (cue) => group.occurrenceIds.includes(cue.id) && cue.startMs !== null,
    )
    .map((cue) => cue.startMs!);
  if (
    starts.length > 1 &&
    project.occurrences.some(
      (cue) =>
        !group.occurrenceIds.includes(cue.id) &&
        cue.startMs !== null &&
        cue.startMs > Math.min(...starts) &&
        cue.startMs < Math.max(...starts),
    )
  )
    warnings.add("Warning: interleaving");
  return [...warnings];
}
export function groupOffset(
  project: Project,
  group: LyricGroup,
  delta: number,
  snap: Snap,
): number {
  const range = groupRange(
    project.occurrences.filter((cue) => group.occurrenceIds.includes(cue.id)),
  );
  if (range.start === null) return 0;
  const snapped = snappedTime(
    range.start + Math.round(delta),
    snap,
    project.occurrences.filter((cue) => !group.occurrenceIds.includes(cue.id)),
  );
  const boundaries = project.occurrences
    .filter((cue) => group.occurrenceIds.includes(cue.id))
    .flatMap((cue) =>
      [cue.startMs, cue.endMs].filter((time): time is number => time !== null),
    );
  return Math.max(-Math.min(...boundaries), snapped - range.start);
}
export function shiftGroup(
  project: Project,
  groupId: string,
  offset: number,
): Project {
  const group = project.lyricGroups?.find((g) => g.id === groupId);
  if (!group) throw Error("Group not found");
  const delta = groupOffset(project, group, offset, "off");
  let next = project;
  for (const cue of project.occurrences) {
    if (group.occurrenceIds.includes(cue.id))
      next = editTiming(next, cue.id, {
        startMs: cue.startMs === null ? null : cue.startMs + delta,
        endMs: cue.endMs === null ? null : cue.endMs + delta,
      });
  }
  return orderGroupedProject(next);
}
export function duplicateGroup(
  project: Project,
  groupId: string,
  name: string,
  offset: number,
) {
  const group = project.lyricGroups?.find((g) => g.id === groupId);
  if (!group || !name.trim()) throw Error("Enter a group name");
  const delta = groupOffset(project, group, offset, "off");
  const members = group.occurrenceIds.map(
    (id) => project.occurrences.find((cue) => cue.id === id)!,
  );
  if (
    members.some(
      (o) =>
        lyricCount(project.phrases.find((p) => p.id === o.phraseId)!.lyricKey) >
        lyricLimit,
    )
  )
    throw Error("This section contains a lyric longer than 11 elements.");
  const copies = members.map((original) => {
    const {
      reviewedTiming: _reviewed,
      automaticTiming: _automatic,
      weakTiming: _weak,
      timingIssue: _issue,
      ...cue
    } = original;
    return {
      ...cue,
      timingReview: "needs-review" as const,
      id: newId(),
      startMs: cue.startMs === null ? null : cue.startMs + delta,
      endMs: cue.endMs === null ? null : cue.endMs + delta,
    };
  });
  const copy = {
    ...group,
    id: newId(),
    name: name.trim(),
    occurrenceIds: copies.map((cue) => cue.id),
  };
  const result = orderGroupedProject({
    ...project,
    occurrences: [...project.occurrences, ...copies],
    lyricGroups: [...(project.lyricGroups ?? []), copy],
    ...(project.timingBaseline
      ? {
          timingBaseline: [
            ...project.timingBaseline,
            ...copies.map((cue) => ({ ...cue, startMs: null, endMs: null })),
          ],
        }
      : {}),
  });
  return { project: result, group: copy, selectedId: copies[0].id };
}
export function groupColor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 75% 65%)`;
}
