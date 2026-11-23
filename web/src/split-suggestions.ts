import { readingParts } from "./reading-parts.ts";
import { alignedReadings } from "./pinyin-alignment.ts";
import { type Word, type Phrase, joinReadings } from "./domain.ts";
export { alignedReadings } from "./pinyin-alignment.ts";

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
  const parts = readingParts(word);
  const portion = (start: number, end: number) => {
    if (!reading) return "";
    if (parts.length === 1) return joinReadings(reading.slice(start, end));
    let offset = 0;
    return parts
      .flatMap((part) => {
        const first = Math.max(offset, start);
        const last = Math.min(offset + [...part.hanzi].length, end);
        offset += [...part.hanzi].length;
        return first < last ? [joinReadings(reading.slice(first, last))] : [];
      })
      .join(" ");
  };
  return {
    leftPinyin: portion(0, boundary),
    rightPinyin: portion(boundary, chars.length),
    leftGloss: gloss(left),
    rightGloss: gloss(right),
  };
}
