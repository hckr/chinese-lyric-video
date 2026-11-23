import { fixSpacing } from "../domain.ts";
import type { DictionaryEntry } from "./dictionary-service.ts";
import { alignedReadings } from "../pinyin-alignment.ts";

export function readingKey(hanzi: string, pinyin: string): string {
  const normalized = pinyin
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/’/gu, "'");
  return (
    alignedReadings({ hanzi, pinyin: normalized })?.join("|") ??
    normalized.replace(/\s+/gu, " ")
  );
}

export function isDictionaryIdiom(meanings: string[]): boolean {
  return meanings.some((sense) => /\(idiom\)/iu.test(sense));
}

export function dictionarySpelling({
  pinyin,
  meanings,
}: Pick<DictionaryEntry, "pinyin" | "meanings">): string {
  return isDictionaryIdiom(meanings)
    ? pinyin.normalize("NFC").trim().replace(/\s+/gu, " ")
    : fixSpacing(pinyin);
}

export function dictionaryReadings(entries: DictionaryEntry[]) {
  const groups = new Map<string, { pinyin: string; meanings: string[] }>();
  for (const entry of entries) {
    if (!entry.pinyin.trim()) continue;
    const key = readingKey(entry.hanzi, entry.pinyin);
    const meanings = [
      ...new Set([...(groups.get(key)?.meanings ?? []), ...entry.meanings]),
    ];
    groups.set(key, {
      pinyin: dictionarySpelling({ pinyin: entry.pinyin, meanings }),
      meanings,
    });
  }
  const archaic = ({ meanings }: { meanings: string[] }) =>
    meanings.length > 0 &&
    meanings.every((sense) =>
      /\((?:archaic|obsolete)\)|^(?:archaic|obsolete)(?:\s|:)/iu.test(
        sense.trim(),
      ),
    );
  return [...groups.values()].sort(
    (a, b) => Number(archaic(a)) - Number(archaic(b)),
  );
}
