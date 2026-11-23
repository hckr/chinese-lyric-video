import type { LyricGroup } from "../lyric-groups.ts";

export type ImportGroup = LyricGroup;
export type SourceRow = { line: number; segment: number; text: string };
type Override = { covered: string[]; group?: ImportGroup };
export type Structure = {
  rows: SourceRow[];
  suggested: ImportGroup[];
  edits: Override[];
  needsReview: string[];
  boundarySource?: string[];
};
const credit =
  /^(唱|演唱|歌手|词|詞|曲|作词|作詞|作曲|编曲|編曲|词曲|詞曲|制作人|製作人|混音|录音|錄音)\s*[:：]\s*.+$/u;
const heading =
  /^(?:\[([^\]\n]+)\]|【([^】\n]+)】|((?:verse|pre-chorus|chorus|bridge|intro|outro)\s*\d*|主歌|副歌):?)$/iu;
export const rowId = (index: number) => `line-${index}`;

export function detectStructure(raw: string): Structure {
  const rows: SourceRow[] = [];
  const sections: { name: string; start: number; end: number }[] = [];
  const lines = raw
    // eslint-disable-next-line no-control-regex -- Recognize legacy line separators.
    .split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/u)
    .map((s) => s.trim());
  const nonempty = lines.filter(Boolean);
  const title =
    nonempty.length > 1 && !credit.test(nonempty[0]) && credit.test(nonempty[1])
      ? lines.indexOf(nonempty[0])
      : -1;
  const explicit = lines.some((line, i) => i !== title && heading.test(line));
  let section: (typeof sections)[number] | undefined;
  lines.forEach((line, i) => {
    if (i === title || credit.test(line)) return;
    const match = heading.exec(line);
    if (match) {
      section = {
        name: (match[1] || match[2] || match[3]).trim(),
        start: rows.length,
        end: rows.length,
      };
      sections.push(section);
      return;
    }
    if (!line && !explicit) section = undefined;
    const segments = (
      /\p{Script=Latin}/u.test(line) ? [line] : line.split(/[，。！？；,!?;]+/u)
    )
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length && !explicit && !section) {
      section = {
        name: `Stanza ${sections.length + 1}`,
        start: rows.length,
        end: rows.length,
      };
      sections.push(section);
    }
    segments.forEach((text, segment) => rows.push({ line: i, segment, text }));
    if (section) section.end = rows.length;
  });
  const suggested = sections
    .filter((s) => s.end - s.start >= 2 && (explicit || sections.length > 1))
    .map((s) => ({
      id: `section-${s.start}`,
      name: s.name || "Section",
      occurrenceIds: rows
        .slice(s.start, s.end)
        .map((_, i) => rowId(s.start + i)),
    }));
  return { rows, suggested, edits: [], needsReview: [] };
}
export function groupsOf(draft: Structure): ImportGroup[] {
  const hidden = new Set(draft.edits.flatMap((edit) => edit.covered));
  return [
    ...draft.suggested.filter(
      (g) => !g.occurrenceIds.some((id) => hidden.has(id)),
    ),
    ...draft.edits.flatMap((edit) => (edit.group ? [edit.group] : [])),
  ].sort(
    (a, b) =>
      Number(a.occurrenceIds[0].slice(5)) - Number(b.occurrenceIds[0].slice(5)),
  );
}

export function replaceGroups(
  draft: Structure,
  removed: ImportGroup[],
  group?: ImportGroup,
): Structure {
  const removedIds = new Set(removed.map((g) => g.id));
  const covered = new Set([
    ...removed.flatMap((g) => g.occurrenceIds),
    ...(group?.occurrenceIds ?? []),
  ]);
  const edits = draft.edits.filter((edit) => {
    if (!edit.group || !removedIds.has(edit.group.id)) return true;
    edit.covered.forEach((id) => covered.add(id));
    return false;
  });
  return { ...draft, edits: [...edits, { covered: [...covered], group }] };
}

export function reviseSource(old: Structure, raw: string): Structure {
  const next = detectStructure(raw);
  next.needsReview = [...old.needsReview];
  if (old.boundarySource) {
    if (
      old.boundarySource.length === next.rows.length &&
      next.rows.every((r, i) => r.text === old.boundarySource![i])
    )
      return old;
    next.needsReview.push("edited phrase boundaries");
  }
  if (!old.edits.length) return next;
  // Match unchanged passages. Repeated passages need unchanged surrounding context
  // to distinguish their appearances when the sequence changes.
  const before = old.rows.map((r) => r.text);
  const after = next.rows.map((r) => r.text);
  let prefix = 0,
    suffix = 0;
  while (prefix < before.length && before[prefix] === after[prefix]) prefix++;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++;
  for (const edit of old.edits) {
    const indices = edit.covered.map((id) => Number(id.slice(5)));
    const start = indices.reduce((a, b) => Math.min(a, b)),
      end = indices.reduce((a, b) => Math.max(a, b));
    const passage = before.slice(start, end + 1);
    const matches = (sequence: string[]) =>
      sequence.flatMap((text, i) =>
        text === before[start] &&
        passage.every((value, j) => sequence[i + j] === value)
          ? [i]
          : [],
      );
    const prior = matches(before),
      candidates = matches(after);
    const match =
      candidates.length === 1 && prior.length === 1
        ? candidates[0]
        : candidates.length === prior.length && end < prefix
          ? start
          : candidates.length === prior.length &&
              start >= before.length - suffix
            ? start + after.length - before.length
            : undefined;
    if (match === undefined || !candidates.includes(match)) {
      next.needsReview.push(edit.group?.name ?? before[start]);
      continue;
    }
    const map = (id: string) => rowId(Number(id.slice(5)) + match - start);
    next.edits.push({
      covered: edit.covered.map(map),
      group: edit.group && {
        ...edit.group,
        occurrenceIds: edit.group.occurrenceIds.map(map),
      },
    });
  }
  return next;
}

/** Replace adjacent rows and remap every section through the boundary change. */
export function changeBoundaries(
  draft: Structure,
  index: number,
  count: number,
  pieces: string[],
): Structure {
  if (
    !pieces.every((piece) => piece.trim()) ||
    pieces.join("") !==
      draft.rows
        .slice(index, index + count)
        .map((r) => r.text)
        .join("")
  )
    throw Error("Keep all lyric text in its original order.");
  const rows = [...draft.rows];
  rows.splice(
    index,
    count,
    ...pieces.map((text) => ({ ...draft.rows[index], text })),
  );
  const suggested = groupsOf(draft).flatMap((group) => {
    const occurrenceIds = group.occurrenceIds.flatMap((id) => {
      const n = Number(id.slice(5));
      if (n < index) return [id];
      if (n === index) return pieces.map((_, j) => rowId(index + j));
      if (n < index + count) return [];
      return [rowId(n + pieces.length - count)];
    });
    return occurrenceIds.length ? [{ ...group, occurrenceIds }] : [];
  });
  return {
    rows,
    suggested,
    edits: [],
    needsReview: draft.needsReview,
    boundarySource: draft.boundarySource ?? draft.rows.map((r) => r.text),
  };
}
