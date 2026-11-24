import { createContext, useContext, type ReactNode } from "react";
import type { useVisibleWords } from "../useVisibleWords";
export const ReadingContext = createContext<
  ReturnType<typeof useVisibleWords> | undefined
>(undefined);
export function EditionReading({
  text,
  compare,
}: {
  text: string;
  compare?: string;
}) {
  const row = useContext(ReadingContext)?.get(text);
  let first = 0,
    last = text.length;
  if (compare !== undefined) {
    while (
      first < Math.min(text.length, compare.length) &&
      text[first] === compare[first]
    )
      first++;
    let end = compare.length;
    while (last > first && end > first && text[last - 1] === compare[end - 1]) {
      last--;
      end--;
    }
  }
  const decorated = (start: number, end: number, node: ReactNode) =>
    compare !== undefined && start < last && end > first ? (
      <mark key={"mark-" + start}>{node}</mark>
    ) : (
      node
    );
  if (!row)
    return compare === undefined ? (
      <>{text}</>
    ) : (
      <>
        {text.slice(0, first)}
        <mark>{text.slice(first, last)}</mark>
        {text.slice(last)}
      </>
    );
  let offset = 0;
  const nodes = [];
  for (const [i, word] of row.words.entries()) {
    const token = word.hanzi || word.translation.en;
    if (!token) continue;
    let at = text.indexOf(token, offset);
    if (at < 0 && /^\p{Script=Han}+$/u.test(token)) {
      const next = text.slice(offset).search(/\p{Script=Han}/u);
      if (next >= 0) at = offset + next;
    }
    if (at < 0) continue;
    const original = text.slice(at, at + token.length);
    nodes.push(decorated(offset, at, text.slice(offset, at)));
    const reading = word.pinyin || row.readings[word.hanzi];
    nodes.push(
      decorated(
        at,
        at + token.length,
        reading ? (
          <ruby key={i}>
            {original}
            <rt>{reading}</rt>
          </ruby>
        ) : (
          original
        ),
      ),
    );
    offset = at + token.length;
  }
  return (
    <>
      {nodes}
      {text.slice(offset)}
    </>
  );
}
