import { z } from "zod";

export const stages = ["vocabulary", "en", "pl"] as const;
export const stageSchema = z.enum(stages);
export type Stage = z.infer<typeof stageSchema>;
export const draftWordSchema = z
  .object({
    hanzi: z.string(),
    pinyin: z.string(),
    translation: z.object({ en: z.string() }).strict(),
  })
  .strict();
export const vocabularySchema = z.array(draftWordSchema).min(1);
export const valueSchema = z.union([z.string(), vocabularySchema]);
export const effortSchema = z.enum(["none", "low", "medium", "high"]);
export const provenanceSchema = z
  .object({
    provider: z.enum(["Gemini", "Groq"]),
    model: z.string(),
    promptVersion: z.string(),
    structured: z.boolean(),
    thinkingEffort: effortSchema.optional(),
    notes: z.string(),
    instruction: z.string().optional(),
    manuallyEdited: z.boolean().optional(),
  })
  .strict();
export const translationSettingsSchema = z
  .object({
    provider: z.enum(["Gemini", "Groq"]).optional(),
    model: z.string().trim().min(1).max(150),
    structured: z.boolean(),
    thinkingEffort: effortSchema.optional(),
    notes: z.string().max(12000),
  })
  .strict();
export const draftSchema = z
  .object({
    id: z.string(),
    phraseId: z.string(),
    stage: stageSchema,
    wordIndex: z.number().int().nonnegative().optional(),
    glossesOnly: z.literal(true).optional(),
    source: z.string(),
    base: z.string(),
    support: z.string().nullable(),
    value: valueSchema,
    mode: z.enum(["fill", "replace"]),
    provenance: provenanceSchema,
    dictionary: z.array(z.string()),
  })
  .strict()
  .refine(
    (draft) =>
      draft.stage === "vocabulary"
        ? Array.isArray(draft.value) &&
          draft.support === null &&
          (draft.wordIndex === undefined || draft.value.length === 1)
        : typeof draft.value === "string" &&
          draft.wordIndex === undefined &&
          draft.support !== null,
    "Translation draft does not match its component",
  );
export const translationSchema = z
  .object({
    drafts: z.array(draftSchema),
    accepted: z.record(
      z.string(),
      z.partialRecord(stageSchema, provenanceSchema),
    ),
    settings: translationSettingsSchema,
  })
  .strict();
export type Draft = z.infer<typeof draftSchema>;
export type DraftWord = z.infer<typeof draftWordSchema>;
export type DraftValue = z.infer<typeof valueSchema>;
export type TranslationState = z.infer<typeof translationSchema>;
export const defaultTranslation: TranslationState = {
  drafts: [],
  accepted: {},
  settings: { model: "gemma-4-26b-a4b-it", structured: true, notes: "" },
};
