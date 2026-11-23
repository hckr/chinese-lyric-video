import type { Word } from "./domain.ts";
import { alignedReadings } from "./pinyin-alignment.ts";

/** Align explicit space-delimited parts only when the supplied reading is unambiguous. */
export function readingParts(word: Word): { hanzi: string; pinyin: string }[] {
  const fallback = [{ hanzi: word.hanzi, pinyin: word.pinyin.trim() || "???" }];
  const groups = word.pinyin.trim().split(/\s+/u);
  if (groups.length < 2 || !/^\p{Script=Han}+$/u.test(word.hanzi))
    return fallback;
  const syllables = alignedReadings(word);
  if (!syllables) return fallback;
  const normalize = (s: string) =>
    s.normalize("NFC").toLowerCase().replace(/['’]/gu, "");
  const chars = [...word.hanzi];
  let offset = 0;
  const parts: { hanzi: string; pinyin: string }[] = [];
  for (const group of groups) {
    const start = offset;
    let reading = "";
    while (
      offset < syllables.length &&
      reading.length < normalize(group).length
    ) {
      reading += normalize(syllables[offset++]);
    }
    if (reading !== normalize(group)) return fallback;
    parts.push({ hanzi: chars.slice(start, offset).join(""), pinyin: group });
  }
  return offset === chars.length ? parts : fallback;
}
