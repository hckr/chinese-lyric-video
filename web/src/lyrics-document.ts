import { newId, type Project } from "./domain.ts";
import { lyricCount, lyricLimit } from "./lyric-length.ts";

export type Line = { id: string; text: string; generatedTerminator?: true };
export type Patch = {
  ids: string[];
  before: string[];
  after: string[];
  label: string;
  context?: string;
};
export function linesFrom(text: string): Line[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((text) => ({ id: newId(), text }));
}
export function editLines(old: Line[], value: string, cursor: number) {
  const parts = value.split("\n");
  // Anchor the changed range at the actual edit endpoint, including repeated lines.
  let right = 0,
    left = 0;
  const endLine = value.slice(0, cursor).split("\n").length - 1;
  while (
    right < old.length &&
    right < parts.length - endLine &&
    old[old.length - 1 - right].text === parts[parts.length - 1 - right] &&
    (right < parts.length - endLine - 1 ||
      cursor === 0 ||
      value[cursor - 1] === "\n")
  )
    right++;
  while (
    left < old.length - right &&
    left < parts.length - right &&
    old[left].text === parts[left]
  )
    left++;
  return [
    ...old.slice(0, left),
    ...parts
      .slice(left, parts.length - right)
      .map((text) => ({ id: newId(), text })),
    ...old.slice(old.length - right),
  ];
}
export function parseLines(lines: Line[]) {
  const rows: (Line & { line: number; section?: string })[] = [];
  const groups: {
    id: string;
    name: string;
    line: number;
    occurrenceIds: string[];
  }[] = [];
  const issues: { line: number; message: string; count?: number }[] = [];
  let group: (typeof groups)[number] | undefined;
  for (const [line, item] of lines.entries()) {
    const trimmed = item.text.trim();
    if (!trimmed) {
      group = undefined;
      continue;
    }
    if (trimmed === "[/]") {
      if (!group)
        issues.push({ line, message: "This terminator has no open section." });
      group = undefined;
    } else if (/[\[\]]/.test(trimmed)) {
      const name = /^\[([^\[\]]+)\]$/.exec(trimmed)?.[1].trim();
      if (!name || name === "/")
        issues.push({
          line,
          message: "Use a heading such as [Chorus], or [/] to end a section.",
        });
      else {
        group = { id: item.id, name, line, occurrenceIds: [] };
        groups.push(group);
      }
    } else {
      rows.push({ ...item, line, section: group?.id });
      group?.occurrenceIds.push(item.id);
      const count = lyricCount(item.text);
      if (count > lyricLimit)
        issues.push({
          line,
          count,
          message: count + " / 11 · Insert a line break.",
        });
    }
  }
  for (const section of groups)
    if (!section.occurrenceIds.length)
      issues.push({
        line: section.line,
        message: "Empty section. Add a lyric or remove the heading.",
      });
  return { rows, groups, issues: issues.sort((a, b) => a.line - b.line) };
}
export function patchIndex(lines: Line[], patch: Patch) {
  const i = lines.findIndex((l) => l.id === patch.ids[0]);
  if (
    i < 0 ||
    patch.ids.some(
      (id, k) =>
        lines[i + k]?.id !== id || lines[i + k].text !== patch.before[k],
    )
  )
    return -1;
  if (
    patch.context !== undefined &&
    sectionContext(lines, i, patch.ids.length) !== patch.context
  )
    return -1;
  return i;
}
export function sectionContext(lines: Line[], start: number, length: number) {
  const parsed = parseLines(lines);
  // Closing markup added by an accepted AI section does not replace an
  // adjacent proposal's lyric anchor. Membership is still checked below.
  let previous = start - 1;
  while (lines[previous]?.generatedTerminator) previous--;
  let following = start + length;
  while (lines[following]?.generatedTerminator) following++;
  return JSON.stringify([
    lines[previous]?.id,
    lines[following]?.id,
    parsed.rows
      .filter((r) => r.line >= start && r.line < start + length)
      .map((r) => r.section ?? null),
  ]);
}
export function applyPatch(lines: Line[], patch: Patch) {
  const at = patchIndex(lines, patch);
  if (at < 0) return lines;
  const old = lines.slice(at, at + patch.ids.length);
  // Preserve occurrence evidence only for the exact same span of lyric text.
  // Headings do not consume lyric offsets, even when identical choruses repeat.
  const originalSpans = new Map<number, Line>();
  let offset = 0;
  for (const line of old) {
    if (line.text.trim() && !line.text.trim().startsWith("[")) {
      originalSpans.set(offset, line);
      offset += line.text.length;
    }
  }
  offset = 0;
  const added = patch.after.map((text, i) => {
    if (!text.trim() || text.trim().startsWith("[")) {
      if (old[i]?.text === text) return old[i];
      return {
        id: newId(),
        text,
        ...(patch.label === "Section heading" &&
        (text === "[/]" || text === "") &&
        i === patch.after.length - 1
          ? { generatedTerminator: true as const }
          : {}),
      };
    }
    const original = originalSpans.get(offset);
    offset += text.length;
    return original?.text === text ? original : { id: newId(), text };
  });
  return [...lines.slice(0, at), ...added, ...lines.slice(at + old.length)];
}
export function projectDocument(project: Project) {
  const memberships = new Map(
    (project.lyricGroups ?? []).flatMap((g) =>
      g.occurrenceIds.map((id) => [id, g] as const),
    ),
  );
  const phrases = new Map(project.phrases.map((p) => [p.id, p.lyricKey]));
  const lines: Line[] = [];
  let previous: string | undefined;
  for (const o of project.occurrences) {
    const group = memberships.get(o.id);
    if (group?.id !== previous)
      lines.push({
        id: group?.id ?? newId(),
        text: group ? "[" + group.name + "]" : "[/]",
      });
    lines.push({ id: o.id, text: phrases.get(o.phraseId)! });
    previous = group?.id;
  }
  return lines;
}
