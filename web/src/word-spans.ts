import type { Word } from "./domain";

export function wordSpans(text: string, words: Word[]) {
  let cursor = 0;
  const spans = words
    .filter((word) => word.hanzi)
    .flatMap((word) => {
      const start = text.indexOf(word.hanzi, cursor);
      if (start < 0) return [];
      cursor = start + word.hanzi.length;
      return [{ word, start, end: cursor }];
    });
  return spans;
}
export function inspectedWord(
  text: string,
  words: Word[],
  offset: number,
  length: number,
) {
  const spans = wordSpans(text, words);
  const index = spans.findIndex((span) => span.end > offset);
  const focused = spans[index < 0 ? spans.length - 1 : index];
  const selectedText = text.slice(offset, offset + length);
  const selection =
    focused &&
    selectedText &&
    /^\p{Script=Han}+$/u.test(selectedText) &&
    spans.some((span) => span.start <= offset && offset < span.end) &&
    spans.some(
      (span) => span.start < offset + length && offset + length <= span.end,
    )
      ? selectedText
      : "";
  const position = selection ? offset : (focused?.start ?? offset);
  const term = selection || focused?.word.hanzi || "";
  return { spans, index, focused, selection, position, term };
}
