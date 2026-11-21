import assert from "node:assert/strict";
import test from "node:test";
import {
  commit,
  projectSchema,
  rawProject,
  serializeProject,
  undo,
} from "../src/domain.ts";
import { exportLegacy, importLegacy } from "../src/legacy.ts";
import { readingParts } from "../src/reading-parts.ts";
import {
  applyDrafts,
  content,
  draftIssues,
  fingerprint,
} from "../src/translation.ts";
import { defaultTranslation, type Draft } from "../src/translation-schema.ts";

test("dependent translation drafts preserve idiom readings, appearances and undo", () => {
  const project = rawProject("一丝一毫\n一丝一毫", "Test", "Test");
  const [phrase] = project.phrases;
  phrase.words = [];
  project.occurrences = project.occurrences.map((cue, i) => ({
    ...cue,
    startMs: i * 1000,
    endMs: i * 1000 + 500,
  }));
  project.lyricGroups = [
    {
      id: "g",
      name: "Repeat",
      occurrenceIds: project.occurrences.map((cue) => cue.id),
    },
  ];
  const value = [
    {
      hanzi: "一丝一毫",
      pinyin: "yī sī yī háo",
      translation: { en: "the slightest bit" },
    },
  ];
  const vocabulary: Draft = {
    id: "v",
    phraseId: phrase.id,
    source: phrase.lyricKey,
    stage: "vocabulary",
    mode: "fill",
    base: fingerprint(content(phrase, "vocabulary")),
    support: null,
    value,
    dictionary: ["evidence"],
    provenance: {
      ...defaultTranslation.settings,
      provider: "Gemini",
      promptVersion: "test",
    },
  };
  const english: Draft = {
    ...vocabulary,
    id: "en",
    stage: "en",
    base: fingerprint(""),
    support: fingerprint(value),
    value: "The slightest bit.",
    dictionary: [],
  };
  project.translationWork = {
    ...defaultTranslation,
    drafts: [vocabulary, english],
  };
  const restored = projectSchema.parse(JSON.parse(serializeProject(project)));
  assert.equal(applyDrafts(restored, ["en"], false), restored);
  const updated = applyDrafts(restored, ["en", "v"], true);
  assert.deepEqual(updated.occurrences, restored.occurrences);
  assert.deepEqual(updated.lyricGroups, restored.lyricGroups);
  assert.equal(updated.phrases[0].translation.en, english.value);
  assert.equal(
    updated.translationWork?.accepted[phrase.id].en?.provider,
    "Gemini",
  );
  assert.deepEqual(draftIssues(phrase, "vocabulary", value), []);
  assert.deepEqual(
    readingParts(updated.phrases[0].words[0]).map((part) => part.pinyin),
    ["yī", "sī", "yī", "háo"],
  );
  const imported = importLegacy(exportLegacy(updated));
  assert.equal(imported.phrases[0].words[0].pinyin, "yī sī yī háo");
  assert.equal(
    imported.phrases[0].words[0].translation.en,
    "the slightest bit",
  );
  const present = { project: restored, phraseId: phrase.id, tokenId: "" };
  assert.deepEqual(
    undo(
      commit(
        { present, past: [], future: [] },
        { ...present, project: updated },
      ),
    ).present,
    present,
  );

  const edited = {
    ...restored,
    phrases: [{ ...phrase, translation: { en: "Human edit", pl: "" } }],
  };
  assert.equal(applyDrafts(edited, ["en"], true), edited);
  const changedVocabulary = {
    ...restored,
    phrases: [
      {
        ...phrase,
        words: [{ ...value[0], id: "new", translation: { en: "Other gloss" } }],
      },
    ],
  };
  assert.equal(
    applyDrafts(changedVocabulary, ["en", "v"], true),
    changedVocabulary,
  );
});

test("word revision preserves neighboring incomplete tokens and approved boundaries", () => {
  const project = rawProject("一丝一毫好", "Test", "Test");
  const [phrase] = project.phrases;
  const unchanged = {
    id: "neighbor",
    hanzi: "好",
    pinyin: "",
    translation: { en: "" },
  };
  const original = {
    id: "idiom",
    hanzi: "一丝一毫",
    pinyin: "yī sī yī háo",
    translation: { en: "" },
  };
  phrase.words = [original, unchanged];
  phrase.segmentationApproved = true;
  const draft: Draft = {
    id: "word",
    phraseId: phrase.id,
    source: phrase.lyricKey,
    stage: "vocabulary",
    wordIndex: 0,
    mode: "replace",
    base: fingerprint(content(phrase, "vocabulary")),
    support: null,
    value: [
      {
        hanzi: original.hanzi,
        pinyin: original.pinyin,
        translation: { en: "an iota" },
      },
    ],
    dictionary: [],
    provenance: {
      ...defaultTranslation.settings,
      provider: "Gemini",
      promptVersion: "test",
    },
  };
  project.translationWork = { ...defaultTranslation, drafts: [draft] };
  const [applied] = applyDrafts(project, [draft.id], false).phrases;
  assert.equal(applied.segmentationApproved, true);
  assert.equal(applied.words[0].id, original.id);
  assert.equal(applied.words[0].translation.en, "an iota");
  assert.equal(applied.words[1], unchanged);
});

test("sentence review flags study notes and preserves lyrical asides", () => {
  const [phrase] = rawProject("做你的猫 喵喵", "Test", "Test").phrases;
  for (const stage of ["en", "pl"] as const) {
    assert.ok(
      draftIssues(phrase, stage, "Meow. [zuò nǐ de māo] (zuò: to be; nǐ: you)")
        .length,
    );
    assert.ok(draftIssues(phrase, stage, "Meow (māo: cat; miāo: meow)").length);
    assert.deepEqual(draftIssues(phrase, stage, "Miau (miau!) [chór]"), []);
  }
});
