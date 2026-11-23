import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dictionaryReadings,
  dictionarySpelling,
  readingKey,
} from "../src/dictionary/dictionary-readings.ts";
import { readingParts } from "../src/reading-parts.ts";
import { parseProject, rawProject } from "../src/domain.ts";
import { exportLegacy, importLegacy } from "../src/legacy.ts";
import { splitSuggestions } from "../src/translations/split-suggestions.ts";

test("dictionary reading order is stable and only archaic-only readings move", () => {
  const readings = dictionaryReadings([
    { hanzi: "听", pinyin: "yǐn", meanings: ["smile (archaic)"] },
    { hanzi: "听", pinyin: "tīng", meanings: ["hear", "administer (archaic)"] },
    { hanzi: "听", pinyin: "tìng", meanings: ["listen (variant)"] },
  ]);
  assert.deepEqual(
    readings.map(({ pinyin }) => pinyin),
    ["tīng", "tìng", "yǐn"],
  );
  assert.deepEqual(readings[0].meanings, ["hear", "administer (archaic)"]);
});

test("spaced readings survive split suggestions and project round trips", () => {
  const project = rawProject("一丝一毫", "Test", "Artist");
  const word = {
    id: "idiom",
    hanzi: "一丝一毫",
    pinyin: "yī sī yī háo",
    translation: { en: "an iota" },
  };
  project.phrases[0].words = [word];
  const split = splitSuggestions(word, 2, project.phrases);
  assert.equal(split.leftPinyin, "yī sī");
  assert.equal(split.rightPinyin, "yī háo");
  assert.equal(
    parseProject(JSON.stringify(project)).phrases[0].words[0].pinyin,
    word.pinyin,
  );
  assert.equal(
    importLegacy(exportLegacy(project)).phrases[0].words[0].pinyin,
    word.pinyin,
  );
});

test("reading comparison keeps tones and syllable boundaries", () => {
  assert.equal(readingKey("西安", "XĪ’ĀN"), readingKey("西安", "xī ān"));
  assert.notEqual(readingKey("西安", "xī ān"), readingKey("西安", "xī àn"));
  assert.equal(
    dictionarySpelling({ pinyin: "xǐ huan", meanings: ["to like"] }),
    "xǐhuan",
  );
  assert.equal(
    dictionarySpelling({
      pinyin: "yī sī yī háo",
      meanings: ["an iota (idiom)"],
    }),
    "yī sī yī háo",
  );
  assert.equal(
    dictionarySpelling({
      pinyin: "yī liǎo bǎi liǎo",
      meanings: ["(idiom) once and for all"],
    }),
    "yī liǎo bǎi liǎo",
  );
  assert.deepEqual(
    readingParts({
      id: "sample",
      hanzi: "喜欢西安",
      pinyin: "xǐhuan xī'ān",
      translation: { en: "" },
    }),
    [
      { hanzi: "喜欢", pinyin: "xǐhuan" },
      { hanzi: "西安", pinyin: "xī'ān" },
    ],
  );
});
