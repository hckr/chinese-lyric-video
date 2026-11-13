import syllables from "./pinyin-syllables.json" with { type: "json" };
import { type Word, type Phrase, joinReadings } from "./domain.ts";
// Shared static Mandarin syllable inventory from Python vocabulary.py. This only
// aligns an existing reading; it never derives pronunciation from Chinese text.
const known = new Set(syllables);
export function alignedReadings(word: Word): string[] | null {
  const count = [...word.hanzi].length;
  const text = word.pinyin.normalize("NFC").toLowerCase().replace(/’/g, "'");
  if (!/^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ'\s]+$/u.test(text) || count > 20)
    return null;
  const solutions: string[][] = [];
  function visit(position: number, parts: string[]) {
    if (solutions.length > 1) return;
    while (/[\s']/u.test(text[position] ?? "") && position < text.length)
      position++;
    if (position === text.length) {
      if (parts.length === count) solutions.push(parts);
      return;
    }
    if (parts.length >= count) return;
    for (
      let end = position + 1;
      end <= Math.min(position + 6, text.length);
      end++
    ) {
      const piece = text.slice(position, end);
      if (/[\s']/u.test(piece)) break;
      const decomposed = piece.normalize("NFD");
      const base = decomposed
        .replace(/u\u0308/g, "ü")
        .replace(/[\u0300-\u036f]/g, "");
      if (
        !known.has(base) ||
        (decomposed.match(/[\u0300\u0301\u0304\u030c]/g) || []).length > 1
      )
        continue;
      if (
        position > 0 &&
        !/[\s']/u.test(text[position - 1]) &&
        /^[aeo]/u.test(base)
      )
        continue;
      if (
        position > 0 &&
        !/[\s']/u.test(text[position - 1]) &&
        ["m", "n", "ng", "hm", "hng", "r"].includes(base)
      )
        continue;
      visit(end, [...parts, piece]);
    }
  }
  visit(0, []);
  return solutions.length === 1 ? solutions[0] : null;
}
export function splitSuggestions(
  word: Word,
  boundary: number,
  phrases: Phrase[],
) {
  const chars = [...word.hanzi],
    left = chars.slice(0, boundary).join(""),
    right = chars.slice(boundary).join("");
  const reading = alignedReadings(word);
  const gloss = (text: string) => {
    const meanings = [
      ...new Set(
        phrases
          .flatMap((p) => p.words)
          .filter((w) => w.hanzi === text && w.translation.en.trim())
          .map((w) => w.translation.en),
      ),
    ];
    return meanings.length === 1 ? meanings[0] : "";
  };
  return {
    leftPinyin: reading ? joinReadings(reading.slice(0, boundary)) : "",
    rightPinyin: reading ? joinReadings(reading.slice(boundary)) : "",
    leftGloss: gloss(left),
    rightGloss: gloss(right),
  };
}
