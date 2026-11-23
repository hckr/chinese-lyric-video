import { readingParts } from "../reading-parts.ts";
import type { Phrase } from "../domain.ts";
import { englishLyric } from "../lyric-length.ts";
import { wordSpans } from "../word-spans.ts";

/** Keep each supplied reading attached to its word when the line wraps. */
export function LyricReading({
  phrase,
  onMissingReading,
}: {
  phrase: Phrase;
  onMissingReading: (wordId: string) => void;
}) {
  if (englishLyric(phrase.lyricKey)) return null;
  const words = phrase.words.filter((word) => word.hanzi);
  const spans = new Map(
    wordSpans(phrase.lyricKey, words).map((span) => [span.word.id, span]),
  );
  const latinBetween = (start: number, end: number) =>
    phrase.lyricKey
      .slice(start, end)
      .split(/\p{Script=Han}+/u)
      .map((text) => text.trim())
      .filter((text) => /\p{Script=Latin}/u.test(text))
      .map((text, index) => (
        <span
          className="lyric-reading-unit lyric-reading-latin"
          key={`latin-${start}-${index}`}
        >
          <span className="lyric-reading-pinyin" lang="en">
            {text}
          </span>
        </span>
      ));
  if (!words.length) {
    const runs = [
      ...phrase.lyricKey.matchAll(/\p{Script=Han}+|[^\p{Script=Han}]+/gu),
    ];
    const hasLatin = /\p{Script=Latin}/u.test(phrase.lyricKey);
    return (
      <div className="lyric-reading">
        {hasLatin ? (
          runs.flatMap((run) =>
            /\p{Script=Han}/u.test(run[0])
              ? [<strong key={run.index}>{run[0]}</strong>]
              : latinBetween(run.index, run.index + run[0].length),
          )
        ) : (
          <strong>{phrase.lyricKey}</strong>
        )}
      </div>
    );
  }
  let offset = 0;
  const content = words.flatMap((word) => {
    const span = spans.get(word.id);
    const latin = span ? latinBetween(offset, span.start) : [];
    if (span) offset = span.end;
    return [
      ...latin,
      <span className="lyric-reading-unit" key={word.id}>
        {readingParts(word).map((part, index) => (
          <span className="lyric-reading-word" key={index}>
            {word.pinyin.trim() ? (
              <span className="lyric-reading-pinyin">{part.pinyin}</span>
            ) : (
              <button
                type="button"
                className="lyric-reading-pinyin missing-reading"
                aria-label={`Edit missing Pinyin for ${word.hanzi}`}
                onClick={() => onMissingReading(word.id)}
              >
                {part.pinyin}
              </button>
            )}
            <strong>{part.hanzi}</strong>
          </span>
        ))}
      </span>,
    ];
  });
  return (
    <div className="lyric-reading">
      {content}
      {latinBetween(offset, phrase.lyricKey.length)}
    </div>
  );
}
