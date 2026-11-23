import { syllableCounts } from "../pinyin-validation.ts";
import inventory from "../pinyin-syllables.json" with { type: "json" };

const syllables = new Set(inventory);
const accents = ["\u0304", "\u0301", "\u030c", "\u0300"];

// Format supplied dictionary readings only; never infer pronunciation from Hanzi.
export function dictionaryText(text: string): string {
  // CC-CEDICT writes paired forms as Traditional|Simplified.
  const simplified = text.replace(
    /([\p{Script=Han}]+)\|([\p{Script=Han}]+)/gu,
    "$2",
  );
  return simplified.replace(/\[([^[\]]+)\]/gu, (original, reading: string) => {
    const parts = reading.trim().split(/\s+/u);
    if (
      !parts.every((part) => {
        const match = /^([a-zü:]+)([0-5])$/iu.exec(part);
        if (!match) return false;
        const base = match[1].toLowerCase().replace(/u:|v/gu, "ü");
        return (
          syllables.has(base) ||
          (base.endsWith("r") && syllables.has(base.slice(0, -1)))
        );
      })
    )
      return original;
    const converted = parts.map((part) => {
      const tone = Number(part.at(-1));
      const letters = part
        .slice(0, -1)
        .replace(/u:/giu, (value) => (value[0] === "U" ? "Ü" : "ü"))
        .replace(/v/giu, (value) => (value === "V" ? "Ü" : "ü"));
      if (tone === 0 || tone === 5) return letters;
      const lower = letters.toLowerCase();
      let index = lower.indexOf("a");
      if (index < 0) index = lower.indexOf("e");
      if (index < 0 && lower.includes("ou")) index = lower.indexOf("o");
      if (index < 0)
        index = Math.max(
          ...[...lower].map((letter, i) => ("iouü".includes(letter) ? i : -1)),
        );
      if (index < 0)
        index = Math.max(lower.lastIndexOf("m"), lower.lastIndexOf("n"));
      if (index < 0) return part;
      return (
        letters.slice(0, index + 1) +
        accents[tone - 1] +
        letters.slice(index + 1)
      ).normalize("NFC");
    });
    return `[${converted.join(" ")}]`;
  });
}

export type DictionaryPart = { text: string; pinyin?: string };

// Keep standalone pronunciation notes inline: only Chinese examples have an anchor.
export function dictionaryParts(text: string): DictionaryPart[] {
  const formatted = dictionaryText(text);
  const parts: DictionaryPart[] = [];
  const examples =
    /([\p{Script=Han}]+(?:\|[\p{Script=Han}]+)*)\s*\[([^[\]\d]+)\]/gu;
  let start = 0;
  for (const match of formatted.matchAll(examples)) {
    if (!syllableCounts(match[2]).size) continue;
    if (match.index > start)
      parts.push({ text: formatted.slice(start, match.index) });
    parts.push({ text: match[1], pinyin: match[2] });
    start = match.index + match[0].length;
  }
  if (start < formatted.length) parts.push({ text: formatted.slice(start) });
  return parts;
}
