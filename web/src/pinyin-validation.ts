import inventory from "./pinyin-syllables.json" with { type: "json" };

const syllables = new Set(inventory);
// Match Python vocabulary.syllable_counts: validate supplied readings, never
// infer pronunciation from Hanzi. Multiple possible parses are valid.
export function syllableCounts(reading: string): Set<number> {
  const value = reading.normalize("NFC").replace(/’/gu, "'");
  // Parentheses are preserved in authored legacy tokens as punctuation.
  const allowed = new Set(
    "abcdefghijklmnopqrstuvwxyzüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹḿ\u0300\u0301\u0304\u030c'()-",
  );
  if (
    ![...value].every(
      (character) => allowed.has(character) || /\s/u.test(character),
    )
  )
    return new Set();
  if (
    [
      "pinyin",
      "pronunciation",
      "hanzi",
      "unknown",
      "none",
      "null",
      "todo",
      "placeholder",
    ].includes(value)
  )
    return new Set();
  let totals = new Set([0]);
  for (const token of value
    .replace(/[()]/gu, "")
    .split(/[\s'-]+/u)
    .filter(Boolean)) {
    const clusters =
      token.normalize("NFD").match(/[^\u0300-\u036f][\u0300-\u036f]*/gu) ?? [];
    if (clusters.join("") !== token.normalize("NFD")) return new Set();
    const letters: string[] = [],
      tones: number[] = [];
    for (const cluster of clusters) {
      const [base, ...marks] = [...cluster];
      if (marks.includes("\u0308") && base !== "u") return new Set();
      const count = marks.filter((mark) =>
        /[\u0300\u0301\u0304\u030c]/u.test(mark),
      ).length;
      if (count > 1) return new Set();
      letters.push(marks.includes("\u0308") ? "ü" : base);
      tones.push(count);
    }
    const reachable = new Map<number, Set<number>>([[0, new Set([0])]]);
    for (let end = 1; end <= letters.length; end++) {
      for (let start = Math.max(0, end - 6); start < end; start++) {
        const candidate = letters.slice(start, end).join("");
        if (
          !syllables.has(candidate) &&
          !(candidate.endsWith("r") && syllables.has(candidate.slice(0, -1)))
        )
          continue;
        if (tones.slice(start, end).reduce((a, b) => a + b, 0) > 1) continue;
        if (
          start > 0 &&
          (/^[aeo]/u.test(candidate) ||
            ["m", "n", "ng", "hm", "hng", "r"].includes(candidate))
        )
          continue;
        for (const count of reachable.get(start) ?? []) {
          if (!reachable.has(end)) reachable.set(end, new Set());
          reachable.get(end)!.add(count + 1);
        }
      }
    }
    const counts = reachable.get(letters.length);
    if (!counts) return new Set();
    totals = new Set([...totals].flatMap((a) => [...counts].map((b) => a + b)));
  }
  totals.delete(0);
  return totals;
}
