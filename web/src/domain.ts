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
const phraseSchema = z.preprocess(
  (input) => {
    if (input && typeof input === "object" && !Array.isArray(input)) {
      const phrase = { ...input } as Record<string, unknown>;
      delete phrase.notes;
      delete phrase.dictionaryEntries;
      return phrase;
    }
    return input;
  },
  z
    .object({
      id,
      lyricKey: z.string().min(1),
      translation: z.object({ en: z.string(), pl: z.string() }).strict(),
      words: z.array(wordSchema),
      review: z.enum(["pending", "reviewed"]),
      segmentationApproved: z.boolean(),
    })
    .strict(),
);
export const occurrenceSchema = z
  .object({
    id,
    phraseId: id,
    startMs: z.number().int().nonnegative().nullable(),
    endMs: z.number().int().nonnegative().nullable(),
  })
  .strict();
export type Occurrence = z.infer<typeof occurrenceSchema>;
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
    occurrences: z.array(occurrenceSchema),
    timingBaseline: z.array(occurrenceSchema).optional(),
    audio: z
      .object({
        name: z.string().min(1),
        size: z.number().int().nonnegative(),
        lastModified: z.number().int().nonnegative(),
        durationMs: z.number().int().positive(),
      })
      .strict()
      .optional(),
    source: z.string(),
    lyricGroups: z
      .array(
        z
          .object({
            id,
            name: z.string().trim().min(1),
            occurrenceIds: z.array(id).min(1),
          })
          .strict(),
      )
      .optional(),
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
      p.occurrences.map((v) => v.id),
      "occurrence ID",
    );
    check(
      p.phrases.flatMap((v) => v.words.map((w) => w.id)),
      "token ID",
    );
    if (
      p.timingBaseline &&
      (p.timingBaseline.length !== p.occurrences.length ||
        p.timingBaseline.some(
          (o, i) =>
            o.id !== p.occurrences[i]?.id ||
            o.phraseId !== p.occurrences[i]?.phraseId,
        ))
    )
      ctx.addIssue({
        code: "custom",
        message: "Timing baseline must match occurrence IDs and order",
      });
    check(
      (p.lyricGroups ?? []).map((group) => group.id),
      "group ID",
    );
    check(
      (p.lyricGroups ?? []).flatMap((group) => group.occurrenceIds),
      "group membership",
    );
    for (const group of p.lyricGroups ?? []) {
      check(group.occurrenceIds, "group appearance ID");
      if (
        group.occurrenceIds.some(
          (id) => !p.occurrences.some((o) => o.id === id),
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "Group contains an unknown appearance",
        });
    }
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
export type Snapshot = {
  project: Project;
  phraseId: string;
  tokenId: string;
  occurrenceId?: string;
};
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
    ...p.occurrences
      .filter(
        (cue, index) =>
          cue.startMs !== null &&
          cue.endMs !== null &&
          cue.endMs > cue.startMs &&
          p.occurrences
            .slice(index + 1)
            .some(
              (other) =>
                other.startMs !== null &&
                other.endMs !== null &&
                other.endMs > other.startMs &&
                cue.startMs! < other.endMs &&
                cue.endMs! > other.startMs,
            ),
      )
      .map(
        (cue) =>
          `${cue.id}: overlapping lyric timings; resolve before final export`,
      ),

    ...p.occurrences
      .filter(
        (o) =>
          p.audio &&
          ((o.startMs ?? 0) > p.audio.durationMs ||
            (o.endMs ?? 0) > p.audio.durationMs),
      )
      .map(
        (o) =>
          `${o.id}: timing exceeds the saved audio duration; verify the soundtrack or edit this occurrence`,
      ),
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

// Structural edits keep stable IDs, original timing snapshots and history data.
export function addAppearance(
  project: Project,
  phraseId: string,
  afterId?: string,
  appearanceId = newId(),
): Project {
  if (!project.phrases.some((p) => p.id === phraseId))
    throw Error("Lyric not found.");
  if (project.occurrences.some((o) => o.id === appearanceId))
    throw Error("Duplicate lyric appearance ID.");
  const cue: Occurrence = {
    id: appearanceId,
    phraseId,
    startMs: null,
    endMs: null,
  };
  const at = afterId
    ? project.occurrences.findIndex((o) => o.id === afterId)
    : project.occurrences.length - 1;
  if (afterId && at < 0) throw Error("Insertion position not found.");
  const insert = (items: Occurrence[]) => [
    ...items.slice(0, at + 1),
    { ...cue },
    ...items.slice(at + 1),
  ];
  return {
    ...project,
    occurrences: insert(project.occurrences),
    ...(project.timingBaseline
      ? { timingBaseline: insert(project.timingBaseline) }
      : {}),
  };
}
export function addLyric(
  project: Project,
  phrase: Phrase,
  afterId?: string,
  appearanceId = newId(),
): Project {
  const existing = project.phrases.find((p) => p.lyricKey === phrase.lyricKey);
  if (existing)
    return addAppearance(project, existing.id, afterId, appearanceId);
  if (project.phrases.some((p) => p.id === phrase.id))
    throw Error("Duplicate lyric ID.");
  const tokenIds = new Set(
    project.phrases.flatMap((p) => p.words.map((w) => w.id)),
  );
  if (phrase.words.some((w) => tokenIds.has(w.id)))
    throw Error("Duplicate word ID.");
  const anchor = project.occurrences.find((cue) => cue.id === afterId);
  const at = anchor
    ? project.phrases.findIndex((p) => p.id === anchor.phraseId)
    : project.phrases.length - 1;
  const updated = addAppearance(
    {
      ...project,
      phrases: [
        ...project.phrases.slice(0, at + 1),
        phrase,
        ...project.phrases.slice(at + 1),
      ],
    },
    phrase.id,
    afterId,
    appearanceId,
  );
  if (anchor?.endMs != null) {
    const startMs = anchor.endMs;
    const occupied = project.occurrences.some(
      (cue) =>
        cue.id !== anchor.id &&
        cue.startMs !== null &&
        cue.endMs !== null &&
        cue.startMs <= startMs &&
        cue.endMs > startMs,
    );
    const nextStart = Math.min(
      ...project.occurrences
        .filter(
          (cue) =>
            cue.id !== anchor.id &&
            cue.startMs !== null &&
            cue.startMs >= startMs,
        )
        .map((cue) => cue.startMs!),
    );
    const endMs = Math.min(
      startMs + 2000,
      nextStart,
      project.audio?.durationMs ?? Infinity,
    );
    if (!occupied && Number.isSafeInteger(endMs) && endMs > startMs) {
      updated.occurrences = updated.occurrences.map((cue) =>
        cue.id === appearanceId ? { ...cue, startMs, endMs } : cue,
      );
    }
  }
  return updated;
}
export function removeAppearance(
  project: Project,
  appearanceId: string,
): Project {
  const cue = project.occurrences.find((o) => o.id === appearanceId);
  if (!cue) throw Error("Lyric appearance not found.");
  const remaining = project.occurrences.filter((o) => o.id !== appearanceId);
  const stillUsed = remaining.some((o) => o.phraseId === cue.phraseId);
  return {
    ...project,
    occurrences: remaining,
    ...(project.lyricGroups
      ? {
          lyricGroups: project.lyricGroups
            .map((group) => ({
              ...group,
              occurrenceIds: group.occurrenceIds.filter(
                (id) => id !== appearanceId,
              ),
            }))
            .filter((group) => group.occurrenceIds.length),
        }
      : {}),
    phrases: stillUsed
      ? project.phrases
      : project.phrases.filter((p) => p.id !== cue.phraseId),
    ...(project.timingBaseline
      ? {
          timingBaseline: project.timingBaseline.filter(
            (o) => o.id !== appearanceId,
          ),
        }
      : {}),
  };
}

export function conflictingLyrics(project: Project): string[] {
  const content = (p: Phrase) =>
    JSON.stringify({
      translation: p.translation,
      words: p.words.map(({ hanzi, pinyin, translation }) => ({
        hanzi,
        pinyin,
        translation,
      })),
    });
  return [
    ...new Set(
      project.phrases
        .filter((p, i, all) =>
          all.some(
            (other, j) =>
              i !== j &&
              other.lyricKey === p.lyricKey &&
              content(other) !== content(p),
          ),
        )
        .map((p) => p.lyricKey),
    ),
  ];
}

export function repeatAppearance(
  project: Project,
  phraseId: string,
  selectedId?: string,
  appearanceId = newId(),
): Project {
  const source =
    project.occurrences.find(
      (cue) => cue.id === selectedId && cue.phraseId === phraseId,
    ) ?? project.occurrences.find((cue) => cue.phraseId === phraseId);
  if (!source) throw Error("Original lyric appearance not found.");
  const next = addAppearance(project, phraseId, source.id, appearanceId);
  return {
    ...next,
    occurrences: next.occurrences.map((cue) =>
      cue.id === appearanceId
        ? { ...cue, startMs: source.startMs, endMs: source.endMs }
        : cue,
    ),
  };
}
