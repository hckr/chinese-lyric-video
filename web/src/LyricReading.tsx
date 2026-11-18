import { readingParts } from "./reading-parts.ts";
import type { Phrase } from "./domain.ts";

/** Keep each supplied reading attached to its word when the line wraps. */
export function LyricReading({ phrase }: { phrase: Phrase }) {
  const words = phrase.words.filter((word) => word.hanzi);
  if (!words.length)
    return (
      <div className="lyric-reading">
        <strong>{phrase.lyricKey}</strong>
      </div>
    );
  return (
    <div className="lyric-reading">
      {words.map((word) => (
        <span className="lyric-reading-unit" key={word.id}>
          {readingParts(word).map((part, index) => (
            <span className="lyric-reading-word" key={index}>
              <span className="lyric-reading-pinyin">{part.pinyin}</span>
              <strong>{part.hanzi}</strong>
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}
