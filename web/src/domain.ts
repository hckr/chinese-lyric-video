import { syllableCounts } from "./pinyin-validation.ts";
import { z } from "zod";

const id = z.string().min(1);
export const wordSchema = z
  .object({
    id,
    hanzi: z.string(),
    pinyin: z.string(),
    translation: z.object({ en: z.string() }).strict(),
  })
  .strict();
const phraseSchema = z
  .object({
    id,
    lyricKey: z.string().min(1),
    translation: z.object({ en: z.string(), pl: z.string() }).strict(),
    words: z.array(wordSchema),
    review: z.enum(["pending", "reviewed"]),
    segmentationApproved: z.boolean(),
    notes: z.string(),
  })
  .strict();
export const projectSchema = z
  .object({
    schemaVersion: z.literal(1),
    format: z.literal("lyric-workbench"),
    metadata: z
      .record(z.string(), z.string())
      .refine(
        (m) => typeof m.title === "string" && typeof m.artist === "string",
        "Title and artist required",
      ),
    phrases: z.array(phraseSchema),
    occurrences: z.array(
      z
        .object({
          id,
          phraseId: id,
          startMs: z.number().int().nonnegative().nullable(),
          endMs: z.number().int().nonnegative().nullable(),
        })
        .strict(),
    ),
    source: z.string(),
  })
  .strict()
  .superRefine((p, ctx) => {
    const check = (values: string[], name: string) => {
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: "custom", message: `Duplicate ${name}` });
    };
    check(
      p.phrases.map((v) => v.id),
      "phrase ID",
    );
    check(
      p.phrases.map((v) => v.lyricKey),
      "lyric key",
    );
    check(
      p.occurrences.map((v) => v.id),
      "occurrence ID",
    );
    check(
      p.phrases.flatMap((v) => v.words.map((w) => w.id)),
      "token ID",
    );
    for (const o of p.occurrences) {
      if (!p.phrases.some((v) => v.id === o.phraseId))
        ctx.addIssue({ code: "custom", message: `Unknown phrase in ${o.id}` });
      if (o.startMs !== null && o.endMs !== null && o.endMs < o.startMs)
        ctx.addIssue({
          code: "custom",
          message: `End precedes start: ${o.id}`,
        });
    }
  });
export type Project = z.infer<typeof projectSchema>;
export type Phrase = z.infer<typeof phraseSchema>;
export type Word = z.infer<typeof wordSchema>;
export const newId = (): string => crypto.randomUUID();
export const hanzi = (text: string) =>
  [...text].filter((c) => /\p{Script=Han}/u.test(c)).join("");
export const linePinyin = (p: Phrase) =>
  p.words
    .filter((w) => w.hanzi)
    .map((w) => w.pinyin)
    .join(" ");
export const parseProject = (source: string): Project =>
  projectSchema.parse(JSON.parse(source));
export const pending = (p: Phrase): Phrase => ({
  ...p,
  review: "pending",
  segmentationApproved: false,
});
export function validatePinyinWords(p: Phrase): string[] {
  return p.words.flatMap((w, i) => {
    const name = `Word ${i + 1} (${w.hanzi || "note"})`;
    const issues: string[] = [];
    if (!w.translation.en.trim()) issues.push(`${name}: missing gloss`);
    if (w.hanzi) {
      if (!w.pinyin.trim()) issues.push(`${name}: missing Pinyin`);
      if (/\s/u.test(w.pinyin))
        issues.push(
          `${name}: remove spaces inside this word’s Pinyin using Fix spacing`,
        );
      if (w.pinyin.trim()) {
        const counts = syllableCounts(w.pinyin);
        const characters = [...hanzi(w.hanzi)];
        const expected = new Set([
          characters.length,
          characters.length -
            characters.slice(1).filter((c) => c === "儿" || c === "兒").length,
        ]);
        if (!counts.size)
          issues.push(
            `${name}: invalid Pinyin syllable sequence; use lowercase tone-marked readings`,
          );
        else if (![...counts].some((count) => expected.has(count)))
          issues.push(
            `${name}: Pinyin syllable count does not match the Chinese characters`,
          );
      }
    } else if (w.pinyin)
      issues.push(`${name}: a grammar note must have empty Pinyin`);
    return issues;
  });
}
export function phraseIssues(p: Phrase): string[] {
  const issues = validatePinyinWords(p);
  if (hanzi(p.words.map((w) => w.hanzi).join("")) !== hanzi(p.lyricKey))
    issues.push(
      "Word coverage differs from the Chinese lyric; preserve character order",
    );
  if (!p.translation.en.trim()) issues.push("English sentence is missing");
  if (!p.translation.pl.trim()) issues.push("Polish sentence is missing");
  return issues;
}
// Apostrophe insertion is a draft/correction of supplied readings, never Hanzi pronunciation lookup.
export function joinReadings(readings: string[]): string {
  return readings
    .filter(Boolean)
    .reduce(
      (a, b) => a + (a && /^[aāáǎàeēéěèoōóǒò]/u.test(b) ? "'" : "") + b,
      "",
    );
}
export function fixSpacing(value: string): string {
  return joinReadings(value.normalize("NFC").trim().split(/\s+/u));
}
export function mergeAdjacentTokens(
  p: Phrase,
  leftId: string,
  edits: { pinyin: string; glossOverride: string },
): Phrase {
  const index = p.words.findIndex((w) => w.id === leftId);
  const a = p.words[index],
    b = p.words[index + 1];
  if (!a?.hanzi || !b?.hanzi)
    throw Error(
      "Select two adjacent lexical words; grammar notes cannot be merged",
    );
  const word = {
    ...a,
    hanzi: a.hanzi + b.hanzi,
    pinyin: edits.pinyin,
    translation: { en: edits.glossOverride },
  };
  return {
    ...pending(p),
    words: [...p.words.slice(0, index), word, ...p.words.slice(index + 2)],
  };
}
export function splitToken(
  p: Phrase,
  tokenId: string,
  edits: {
    hanziBoundary: number;
    leftPinyin: string;
    rightPinyin: string;
    leftGloss: string;
    rightGloss: string;
  },
  rightId = newId(),
): Phrase {
  const index = p.words.findIndex((w) => w.id === tokenId),
    original = p.words[index];
  if (!original?.hanzi || hanzi(original.hanzi) !== original.hanzi)
    throw Error("Split requires a lexical word containing only Hanzi");
  const chars = [...original.hanzi],
    boundary = edits.hanziBoundary;
  if (!Number.isInteger(boundary) || boundary < 1 || boundary >= chars.length)
    throw Error("Choose a boundary between Hanzi characters");
  if (p.words.some((w) => w.id === rightId))
    throw Error("New token ID must be unique");
  const left = {
    ...original,
    hanzi: chars.slice(0, boundary).join(""),
    pinyin: edits.leftPinyin,
    translation: { en: edits.leftGloss },
  };
  const right = {
    id: rightId,
    hanzi: chars.slice(boundary).join(""),
    pinyin: edits.rightPinyin,
    translation: { en: edits.rightGloss },
  };
  return {
    ...pending(p),
    words: [
      ...p.words.slice(0, index),
      left,
      right,
      ...p.words.slice(index + 1),
    ],
  };
}
export type Snapshot = { project: Project; phraseId: string; tokenId: string };
export type History = {
  present: Snapshot;
  past: Snapshot[];
  future: Snapshot[];
};
export function commit(h: History, next: Snapshot): History {
  return { present: next, past: [...h.past.slice(-99), h.present], future: [] };
}
export function undo(h: History): History {
  const previous = h.past.at(-1);
  return previous
    ? {
        present: previous,
        past: h.past.slice(0, -1),
        future: [h.present, ...h.future],
      }
    : h;
}
export function redo(h: History): History {
  const next = h.future[0];
  return next
    ? { present: next, past: [...h.past, h.present], future: h.future.slice(1) }
    : h;
}
export function rawProject(
  raw: string,
  title: string,
  artist: string,
): Project {
  const lines = raw
    .replace(
      /^\s*(\[[^\]\n]+\]|【[^】\n]+】|(?:verse|chorus|bridge|intro|outro)\s*\d*:?|主歌|副歌)\s*$/gim,
      "",
    )
    .split(/[\n，。！？；,!?;]+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length) throw Error("No lyric phrases found");
  const keys = [...new Set(lines)];
  return projectSchema.parse({
    schemaVersion: 1,
    format: "lyric-workbench",
    metadata: { title, artist },
    source: "raw",
    phrases: keys.map((lyricKey, i) => ({
      id: `phrase-${i}`,
      lyricKey,
      translation: { en: "", pl: "" },
      words: [],
      review: "pending",
      segmentationApproved: false,
      notes: "",
    })),
    occurrences: lines.map((key, i) => ({
      id: `line-${i}`,
      phraseId: `phrase-${keys.indexOf(key)}`,
      startMs: null,
      endMs: null,
    })),
  });
}
export function exportIssues(p: Project): string[] {
  return [
    ...p.phrases.flatMap((v) =>
      phraseIssues(v).map((s) => `${v.lyricKey}: ${s}`),
    ),
    ...p.phrases
      .filter((v) => v.review !== "reviewed")
      .map((v) => `${v.lyricKey}: unreviewed`),
    ...p.occurrences
      .filter(
        (o) => o.startMs === null || o.endMs === null || o.endMs <= o.startMs,
      )
      .map(
        (o) =>
          `${o.id}: unassigned or zero-length timing (TS draft uses zero for unassigned boundaries)`,
      ),
  ];
}
