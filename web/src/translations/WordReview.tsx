import { dictionarySpelling } from "../dictionary/dictionary-readings.ts";
import { hasHanzi } from "../lyric-length";
import { inspectedWord } from "../word-spans";
import { DictionaryLookup } from "../dictionary/DictionaryLookup";
import { useEffect, useState } from "react";
import { newId, parseProject, type Project, type Word } from "../domain";
import type { DictionaryEntry } from "../dictionary/dictionary-service";

type Review = {
  project: Project;
  terms: Record<string, DictionaryEntry[]>;
  boundaries: Record<string, string[]>;
};
export function useWordReview(line?: { id: string; text: string }) {
  const [review, setReview] = useState<Review>();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const text = line?.text,
    id = line?.id;
  useEffect(() => {
    setReview(undefined);
    setError("");
    if (!id || !text) return;
    const controller = new AbortController();
    async function load() {
      const res = await fetch("/api/import-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review: true,
          document: { occurrences: [{ id, text }], groups: [] },
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw Error("Local dictionary review unavailable.");
      const data = await res.json();
      if (!controller.signal.aborted)
        setReview({
          ...data,
          project: parseProject(JSON.stringify(data.project)),
        });
    }
    void load().catch((e) => {
      if (!controller.signal.aborted) setError(String(e.message));
    });
    return () => controller.abort();
  }, [id, text, attempt]);
  return { review, error, retry: () => setAttempt((n) => n + 1) };
}
export type WordProvider = {
  provider: string;
  model: string;
  structured: boolean;
  thinkingEffort?: string;
};
export function WordReview({
  text,
  words,
  terms,
  choose,
  provider,
  offset,
  length,
}: {
  text: string;
  words: Word[];
  terms: Review["terms"];
  choose: (words: Word[]) => void;
  provider?: WordProvider;
  offset: number;
  length: number;
}) {
  const { spans, index, focused, selection, position, term } = inspectedWord(
    text,
    words,
    offset,
    length,
  );
  const inspected =
    selection &&
    !(focused?.start === position && focused.word.hanzi === selection)
      ? {
          id: "selection",
          hanzi: selection,
          pinyin: "",
          translation: { en: "" },
        }
      : focused?.word;
  const references = terms[term] ?? [];
  const options = Object.keys(terms)
    .filter(
      (candidate) => candidate !== term && text.startsWith(candidate, position),
    )
    .sort((a, b) => a.length - b.length);
  const splitAt =
    focused &&
    offset > focused.start &&
    offset < focused.end &&
    Array.from(focused.word.hanzi)[0]?.length <= offset - focused.start &&
    !/^[\uDC00-\uDFFF]/u.test(text.slice(offset))
      ? offset
      : undefined;
  function pick(entry: DictionaryEntry) {
    const end = position + entry.hanzi.length;
    const make = (hanzi: string, pinyin: string): Word => ({
      id: newId(),
      hanzi,
      pinyin,
      translation: { en: "" },
    });
    const result: Word[] = [];
    let cursor = 0,
      added = false;
    for (const word of words) {
      if (!word.hanzi) {
        result.push(word);
        continue;
      }
      const from = text.indexOf(word.hanzi, cursor);
      if (from < 0) return;
      cursor = from + word.hanzi.length;
      if (cursor <= position || from >= end) {
        result.push(word);
        continue;
      }
      const remainder = (part: string) => {
        if (!part) return;
        const readings = new Set(
          (terms[part] ?? []).map((r) => dictionarySpelling(r)),
        );
        result.push(make(part, readings.size === 1 ? [...readings][0] : ""));
      };
      if (from < position) remainder(text.slice(from, position));
      if (!added) {
        result.push(make(entry.hanzi, dictionarySpelling(entry)));
        added = true;
      }
      if (cursor > end) remainder(text.slice(end, cursor));
    }
    if (added) choose(result);
  }
  return (
    <div className="word-review">
      <DictionaryLookup
        word={inspected}
        entries={references}
        controls={
          <div className="word-review-actions">
            {selection && (
              <button
                onClick={() =>
                  pick({
                    hanzi: selection,
                    pinyin: references.length === 1 ? references[0].pinyin : "",
                    meanings: [],
                  })
                }
              >
                Use selection as word
              </button>
            )}
            {focused && splitAt !== undefined && !selection && (
              <button
                onClick={() => {
                  const prefix = text.slice(focused.start, splitAt);
                  const entries = terms[prefix] ?? [];
                  pick({
                    hanzi: prefix,
                    pinyin: entries.length === 1 ? entries[0].pinyin : "",
                    meanings: [],
                  });
                }}
              >
                Split at cursor
              </button>
            )}
            {!selection &&
              focused &&
              spans[index + 1]?.start === focused.end && (
                <button
                  onClick={() => {
                    const merged =
                      focused.word.hanzi + spans[index + 1].word.hanzi;
                    const entries = terms[merged] ?? [];
                    pick({
                      hanzi: merged,
                      pinyin: entries.length === 1 ? entries[0].pinyin : "",
                      meanings: [],
                    });
                  }}
                >
                  Merge with next
                </button>
              )}
            {options.map((candidate) => (
              <div className="division-choice" key={candidate}>
                <span>
                  {focused && position + candidate.length < focused.end
                    ? "Split after "
                    : "Use word "}
                  {candidate}
                </span>
                {[
                  ...new Map(
                    terms[candidate].map((entry) => [
                      dictionarySpelling(entry),
                      entry,
                    ]),
                  ).values(),
                ].map((entry, i) => (
                  <button key={candidate + i} onClick={() => pick(entry)}>
                    {dictionarySpelling(entry)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        }
        onPick={pick}
        advice={{
          provider,
          text,
          position,
          choices: options.flatMap((key) => terms[key]),
        }}
      />
    </div>
  );
}

export function PassagePinyin({ id, text }: { id: string; text: string }) {
  const chinese = hasHanzi(text);
  const { review, error, retry } = useWordReview(
    chinese ? { id, text } : undefined,
  );
  const words = review?.project.phrases[0]?.words.filter((w) =>
    hasHanzi(w.hanzi),
  );
  if (!chinese) return null;
  return (
    <div className="passage-pinyin">
      {error ? (
        <button onClick={retry}>Retry Pinyin lookup</button>
      ) : words ? (
        <p lang="zh-Latn">
          {words.length
            ? words
                .map((word) => {
                  const readings = [
                    ...new Set(
                      (review?.terms[word.hanzi] ?? []).map((entry) =>
                        dictionarySpelling(entry),
                      ),
                    ),
                  ];
                  return (
                    word.hanzi +
                    " " +
                    (readings.join(" / ") || word.pinyin || "—")
                  );
                })
                .join(" · ")
            : "No Pinyin readings available."}
        </p>
      ) : (
        <p role="status">Loading Pinyin…</p>
      )}
    </div>
  );
}
