import type { Project, Occurrence } from "./domain.ts";
import { sidebarUnits } from "./lyric-groups.ts";
export type TimelineLayout = {
  tops: Map<string, number>;
  rails: Map<string, number>;
  height: number;
  order: string[];
  rows: Map<string, number>;
  sizes: Map<string, number>;
  times: Map<string, string>;
  owners: Map<string, string>;
};
const timed = (cue: Occurrence) =>
  cue.startMs !== null && cue.endMs !== null && cue.endMs > cue.startMs;

// Pack committed geometry. Pointer previews reuse this layout until the drop.
export function timelineLayout(project: Project): TimelineLayout {
  const result: TimelineLayout = {
    tops: new Map(),
    rails: new Map(),
    height: 100,
    order: [],
    rows: new Map(),
    sizes: new Map(),
    times: new Map(),
    owners: new Map(),
  };
  const placed: { start: number; end: number; top: number; bottom: number }[] =
    [];
  for (const unit of sidebarUnits(project)) {
    const cues = unit.members
      .filter(timed)
      .sort((a, b) => a.startMs! - b.startMs!);
    if (!cues.length) continue;
    const owner = unit.group ? `group:${unit.group.id}` : `cue:${cues[0].id}`;
    const ends: number[] = [];
    for (const cue of cues) {
      let row = ends.findIndex((end) => end <= cue.startMs!);
      if (row < 0) row = ends.length;
      ends[row] = cue.endMs!;
      result.rows.set(cue.id, row);
      result.owners.set(cue.id, owner);
      result.times.set(cue.id, `${cue.startMs}:${cue.endMs}`);
    }
    const start = Math.min(...cues.map((cue) => cue.startMs!));
    const end = Math.max(...cues.map((cue) => cue.endMs!));
    // Every row reserves rail space so standalone and grouped blocks align.
    const header = 28;
    const height = header + ends.length * 74;
    const conflicts = placed.filter(
      (box) => start < box.end && end > box.start,
    );
    let top = 8;
    // A group reserves its rail and members as one compact rectangle.
    for (const box of [...conflicts].sort((a, b) => a.top - b.top)) {
      if (top + height + 8 <= box.top) break;
      if (top < box.bottom + 8) top = box.bottom + 8;
    }
    placed.push({ start, end, top, bottom: top + height });
    result.order.push(owner);
    result.sizes.set(owner, ends.length);
    if (unit.group) result.rails.set(unit.group.id, top);
    for (const cue of cues)
      result.tops.set(cue.id, top + header + result.rows.get(cue.id)! * 74);
    result.height = Math.max(result.height, top + height + 12);
  }
  return result;
}
