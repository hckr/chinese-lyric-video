import { test } from "node:test";
import assert from "node:assert/strict";
import { readingParts } from "../src/reading-parts.ts";
const word = (hanzi: string, pinyin: string) => ({
  id: "test",
  hanzi,
  pinyin,
  translation: { en: "" },
});
test("explicit reading parts align to characters while joined lexical words stay together", () => {
  assert.deepEqual(readingParts(word("一丝一毫", "yī sī yī háo")), [
    { hanzi: "一", pinyin: "yī" },
    { hanzi: "丝", pinyin: "sī" },
    { hanzi: "一", pinyin: "yī" },
    { hanzi: "毫", pinyin: "háo" },
  ]);
  assert.deepEqual(readingParts(word("喜欢你", "xǐhuan nǐ")), [
    { hanzi: "喜欢", pinyin: "xǐhuan" },
    { hanzi: "你", pinyin: "nǐ" },
  ]);
  assert.deepEqual(readingParts(word("喜欢", "xǐhuan")), [
    { hanzi: "喜欢", pinyin: "xǐhuan" },
  ]);
  assert.deepEqual(readingParts(word("你好", "nǐ invalid")), [
    { hanzi: "你好", pinyin: "nǐ invalid" },
  ]);
  assert.deepEqual(readingParts(word("听", "")), [
    { hanzi: "听", pinyin: "???" },
  ]);
});
