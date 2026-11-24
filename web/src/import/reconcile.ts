import { suggestPieces } from "../lyric-length.ts";
import type { findLyrics } from "./song-source.ts";
import type { EditionTiming } from "./edition-cues.ts";
export type Edition = Awaited<ReturnType<typeof findLyrics>>[number];
type Line = { text: string; startMs?: number };
export const wordsKey = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .match(/\p{Script=Latin}+(?:['’]\p{Script=Latin}+)*|[\p{L}\p{N}]/gu)
    ?.map((token) =>
      /\p{Script=Latin}/u.test(token) ? "|" + token + "|" : token,
    )
    .join("") ?? "";
function lines(row: Edition): Line[] {
  return row.cues.length
    ? row.cues.filter((c) => c.text)
    : row.text
        .split(/\r?\n/)
        .filter((t) => t.trim())
        .map((text) => ({ text }));
}
function similarity(a: string, b: string) {
  if (a === b) return 1;
  const chars = new Map<string, number>();
  for (const c of a) chars.set(c, (chars.get(c) ?? 0) + 1);
  let common = 0;
  for (const c of b) {
    const n = chars.get(c) ?? 0;
    if (n) {
      common++;
      chars.set(c, n - 1);
    }
  }
  return (2 * common) / Math.max(1, a.length + b.length);
}
type Span = { from: number; to: number; lines: Line[] };
function align(base: Line[], other: Line[]): Span[] {
  const a = base.map((l) => wordsKey(l.text)),
    b = other.map((l) => wordsKey(l.text));
  const width = b.length + 1,
    scores = new Float64Array((a.length + 1) * width).fill(Infinity),
    previous = new Uint32Array(scores.length);
  scores[0] = 0;
  for (let i = 0; i <= a.length; i++)
    for (let j = 0; j <= b.length; j++) {
      const at = i * width + j;
      const offer = (x: number, y: number, cost: number) => {
        const dest = (i + x) * width + j + y;
        const v = scores[at] + cost;
        if (v < scores[dest]) {
          scores[dest] = v;
          previous[dest] = at;
        }
      };
      if (i < a.length) offer(1, 0, 1);
      if (j < b.length) offer(0, 1, 1);
      if (i >= a.length || j >= b.length) continue;
      offer(1, 1, 1.65 * (1 - similarity(a[i], b[j])));
      // Walk across as many lines as necessary to find the first shared
      // text boundary, retaining the original line starts on both sides.
      let x = 1,
        y = 1,
        left = a[i],
        right = b[j];
      while (left && right && left !== right) {
        if (left.startsWith(right) && j + y < b.length) right += b[j + y++];
        else if (right.startsWith(left) && i + x < a.length) left += a[i + x++];
        else break;
      }
      if ((x > 1 || y > 1) && left === right) offer(x, y, 0.05);
    }
  const spans: Span[] = [];
  let i = a.length,
    j = b.length;
  while (i || j) {
    const prior = previous[i * width + j],
      from = Math.floor(prior / width),
      start = prior % width;
    spans.push({ from, to: i, lines: other.slice(start, j) });
    i = from;
    j = start;
  }
  return spans.reverse();
}
export type Passage = { variants: Line[][]; different: boolean };
export function passages(editions: Edition[]): Passage[] {
  const base = lines(editions[0]),
    maps = editions.map((e, i) =>
      i
        ? align(base, lines(e))
        : base.map((l, j) => ({ from: j, to: j + 1, lines: [l] })),
    );
  const result: Passage[] = [];
  const add = (variants: Line[][]) => {
    if (variants.some((v) => v.length))
      result.push({
        variants,
        different:
          new Set(
            variants.map((v) => v.map((l) => wordsKey(l.text)).join("\n")),
          ).size > 1,
      });
  };
  for (let i = 0; i <= base.length; ) {
    add(
      maps.map((m) =>
        m.filter((s) => s.from === i && s.to === i).flatMap((s) => s.lines),
      ),
    );
    if (i === base.length) break;
    let end = i + 1;
    for (let j = i; j < end; j++)
      for (const m of maps)
        for (const s of m) if (s.from === j) end = Math.max(end, s.to);
    add(
      maps.map((m) =>
        m
          .filter(
            (s) => s.from >= i && s.from < end && (s.to > s.from || s.from > i),
          )
          .flatMap((s) => s.lines),
      ),
    );
    i = end;
  }
  return result;
}
export function differenceType(left: Line[], right: Line[]) {
  const a = left.map((l) => wordsKey(l.text)),
    b = right.map((l) => wordsKey(l.text));
  if (!a.length && b.length) return "Added passage";
  if (!b.length && a.length) return "Omitted passage";
  if (a.join("") !== b.join("")) return "Different words";
  if (a.join("\n") !== b.join("\n")) return "Different line breaks";
  if (
    left.some(
      (l, i) =>
        l.startMs !== undefined &&
        right[i]?.startMs !== undefined &&
        l.startMs !== right[i].startMs,
    )
  )
    return "Different timing";
  return "Same words and breaks";
}
export type Choice = {
  edition: number;
  text: string;
  useStarts: boolean;
  timingEdition?: number;
  boundaryChoices?: Record<number, number | null>;
};
export function passageBoundaries(
  block: Passage,
  choice: Choice,
  editions: Edition[],
) {
  const variants = block.variants;
  const result = [];
  const key = wordsKey(choice.text);
  const anchors = new Map<number, { startMs: number; editionId: number }[]>();
  for (const index of [
    ...new Set([
      choice.timingEdition ?? choice.edition,
      choice.edition,
      ...editions.map((_, j) => j),
    ]),
  ]) {
    const variant = variants[index];
    const sourceKey = wordsKey(variant.map((l) => l.text).join(" "));
    let offset = 0;
    for (const l of variant) {
      const lineKey = wordsKey(l.text);
      // A different version can still share an entire line. Transfer its
      // timestamp only when the match within this aligned passage is unique.
      const match = sourceKey === key ? offset : key.indexOf(lineKey);
      const corresponds =
        sourceKey === key ||
        (lineKey.length > 0 &&
          match >= 0 &&
          key.lastIndexOf(lineKey) === match &&
          sourceKey.indexOf(lineKey) === offset &&
          sourceKey.lastIndexOf(lineKey) === offset);
      if (l.startMs !== undefined && corresponds) {
        const items = anchors.get(match) ?? [];
        items.push({
          startMs: l.startMs,
          editionId: editions[index].credit.id,
        });
        anchors.set(match, items);
      }
      offset += wordsKey(l.text).length;
    }
  }
  let offset = 0;
  for (const text of choice.text
    .split("\n")
    .flatMap((l) => suggestPieces(l))
    .map((s) => s.trim())
    .filter(Boolean)) {
    const options = anchors.get(offset) ?? [],
      override = choice.boundaryChoices?.[offset],
      anchor = options.find((a) => a.editionId === override) ?? options[0];
    result.push({
      text,
      options,
      offset,
      anchor,
      acceptStart: choice.useStarts && override !== null && !!anchor,
    });
    offset += wordsKey(text).length;
  }

  return result;
}
export function chosenTiming(
  blocks: Passage[],
  choices: Choice[],
  editions: Edition[],
  fingerprint: string,
): EditionTiming {
  const cues: EditionTiming["cues"] = [],
    pieces: EditionTiming["pieces"] = [];
  const credits = new Map<number, Edition["credit"]>();
  for (const [i, choice] of choices.entries()) {
    const source = editions[choice.edition].credit;
    if (!choice.text.trim()) continue;
    credits.set(source.id, source);
    let passageCue = -1;
    for (const { text, anchor, acceptStart, options } of passageBoundaries(
      blocks[i],
      choice,
      editions,
    )) {
      if (anchor)
        credits.set(
          anchor.editionId,
          editions.find((e) => e.credit.id === anchor.editionId)!.credit,
        );
      if (anchor) {
        passageCue = cues.length;
        cues.push({ startMs: anchor.startMs, text });
      }
      pieces.push({
        id: crypto.randomUUID(),
        text,
        cue: passageCue,
        sourceId: source.id,
        sourceStart: anchor?.startMs,
        timingSourceId: anchor?.editionId,
        alternativeStarts: [
          ...new Set(options.map((option) => option.startMs)),
        ],
        acceptStart:
          acceptStart &&
          new Set(options.map((option) => option.startMs)).size === 1,
      });
    }
  }
  return {
    fingerprint,
    editionId: [...credits.keys()][0] ?? editions[0].credit.id,
    cues,
    pieces,
    credits: [...credits.values()].map((c) => ({
      ...c,
      cues: editions.find((e) => e.credit.id === c.id)!.cues,
    })),
  };
}
