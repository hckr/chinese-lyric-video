export const lyricLimit = 11;
export const hasHanzi = (text: string) => /\p{Script=Han}/u.test(text);
export const englishLyric = (text: string) =>
  /\p{Script=Latin}/u.test(text) && !hasHanzi(text);
export function lyricElements(text: string) {
  return text.matchAll(
    /\p{Script=Han}|(?:\p{Script=Latin}\p{M}*)+(?:['’](?:\p{Script=Latin}\p{M}*)+)*|\p{N}/gu,
  );
}
export function lyricCount(text: string) {
  return hasHanzi(text) ? [...lyricElements(text)].length : 0;
}

export function suggestPieces(text: string, words?: string[]): string[] {
  if (!hasHanzi(text)) return [text];
  const segments =
    Array.isArray(words) && words.join("") === text
      ? words
      : Array.from(
          new Intl.Segmenter("zh", { granularity: "word" }).segment(text),
          (part) => part.segment,
        );
  const result: string[] = [];
  const graphemes = new Intl.Segmenter("zh");
  let current = "",
    pause = 0;
  for (const segment of segments) {
    if (lyricCount(current) && lyricCount(current + segment) > lyricLimit) {
      if (pause && lyricCount(current.slice(0, pause))) {
        result.push(current.slice(0, pause));
        current = current.slice(pause);
      }
      if (lyricCount(current) && lyricCount(current + segment) > lyricLimit) {
        result.push(current);
        current = "";
      }
      pause = 0;
    }
    for (const { segment: character } of graphemes.segment(segment)) {
      if (lyricCount(current + character) > lyricLimit) {
        result.push(current);
        current = "";
        pause = 0;
      }
      current += character;
      if (/[，。！？；、：,.!?;:]/u.test(character)) pause = current.length;
    }
  }
  if (current) result.push(current);
  return result;
}

export function validPieces(text: string, pieces: string[]) {
  return (
    pieces.length > 0 &&
    pieces.join("") === text &&
    pieces.every((piece) => piece.trim() && lyricCount(piece) <= lyricLimit)
  );
}
