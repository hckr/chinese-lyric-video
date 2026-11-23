import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dictionaryText,
  dictionaryParts,
} from "../src/dictionary/dictionary-text.ts";

test("dictionary examples display diacritics with unmarked neutral tones", () => {
  assert.equal(
    dictionaryText("皮革的[pi2 ge2 de5] or 新的[xin1 de5]"),
    "皮革的[pí gé de] or 新的[xīn de]",
  );
  assert.equal(
    dictionaryText("[pao3 tang2 r5 de5] [di4] [di5]"),
    "[pǎo táng r de] [dì] [di]",
  );
});
test("tone placement, ü variants, capitals and syllabic consonants are preserved", () => {
  assert.equal(
    dictionaryText("[liu2 gui4 zhong4 nu:3 lv4 NÜ3 n1 m2]"),
    "[liú guì zhòng nǚ lǜ NǙ n̄ ḿ]",
  );
});
test("dictionary display leaves prose and non-Pinyin brackets alone and is idempotent", () => {
  const text = "Note [if] [page 2] [hello2] [ni6] [nǐ] [ni3 hao3]";
  const formatted = "Note [if] [page 2] [hello2] [ni6] [nǐ] [nǐ hǎo]";
  assert.equal(dictionaryText(text), formatted);
  assert.equal(dictionaryText(formatted), formatted);
});

test("Chinese examples carry hover readings while standalone pronunciation notes stay inline", () => {
  assert.deepEqual(
    dictionaryParts('如 皮革的[pi2 ge2 de5] "leather"; also pr. [di4]'),
    [
      { text: "如 " },
      { text: "皮革的", pinyin: "pí gé de" },
      { text: ' "leather"; also pr. [dì]' },
    ],
  );
  assert.deepEqual(dictionaryParts("跑堂兒的|跑堂儿的 [pao3 tang2 r5 de5]"), [
    { text: "跑堂儿的", pinyin: "pǎo táng r de" },
  ]);
  assert.deepEqual(dictionaryParts("新的[xīn de] 你[ni6] [if]"), [
    { text: "新的", pinyin: "xīn de" },
    { text: " 你[ni6] [if]" },
  ]);
});

test("dictionary references hide Traditional variants without changing other separators", () => {
  const source = "跑堂兒的|跑堂儿的[pao3 tang2 r5 de5]; 貓|猫; A|B";
  assert.equal(dictionaryText(source), "跑堂儿的[pǎo táng r de]; 猫; A|B");
  assert.equal(dictionaryText(dictionaryText(source)), dictionaryText(source));
});
