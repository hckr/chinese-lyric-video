import { useEffect, useState } from "react";
import {
  lookupDictionary,
  type DictionaryEntry,
} from "./dictionary-service.ts";
import { dictionaryParts } from "./dictionary-text.ts";
import { readingParts } from "./reading-parts.ts";
import type { Word } from "./domain.ts";

export function DictionaryLookup({
  word,
  onOpenWiktionary,
}: {
  word?: Word;
  onOpenWiktionary: (term: string) => void;
}) {
  const term = word?.hanzi ?? "";
  const [lookup, setLookup] = useState<{
    term: string;
    entries: DictionaryEntry[];
    error?: string;
  }>({ term: "", entries: [] });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!term) return;
    let active = true;
    void lookupDictionary(term).then(
      (entries) => {
        if (active) setLookup({ term, entries });
      },
      (error) => {
        if (active)
          setLookup({
            term,
            entries: [],
            error: error instanceof Error ? error.message : String(error),
          });
      },
    );
    return () => {
      active = false;
    };
  }, [term, retry]);
  const references =
    lookup.term === term && !lookup.error ? lookup.entries : [];
  const readings = new Map<string, string[]>();
  for (const entry of references) {
    if (entry.hanzi !== word?.hanzi) continue;
    readings.set(entry.pinyin, [
      ...new Set([...(readings.get(entry.pinyin) ?? []), ...entry.meanings]),
    ]);
  }
  const reading = readings.size === 1 ? [...readings.keys()][0] : word?.pinyin;
  return (
    <section className="dictionary-lookup" aria-label="Dictionary lookup">
      {!word ? (
        <p>Focus a word field to look it up.</p>
      ) : !word.hanzi ? (
        <p>Grammar notes have no dictionary entry.</p>
      ) : (
        <>
          <div className="dictionary-lookup-header">
            <div
              className={`dictionary-word ${readings.size === 1 ? "single-reading" : ""}`}
            >
              {readings.size === 1 && reading ? (
                readingParts({ ...word, pinyin: reading }).map(
                  (part, index) => (
                    <span className="dictionary-reading-part" key={index}>
                      <span>{part.pinyin}</span>
                      <strong lang="zh-Hans">{part.hanzi}</strong>
                    </span>
                  ),
                )
              ) : (
                <>
                  <strong lang="zh-Hans">{word.hanzi}</strong>
                  {reading && <span>{reading}</span>}
                </>
              )}
            </div>
            <button
              className="dictionary-wiktionary"
              onClick={() => onOpenWiktionary(word.hanzi)}
              aria-label="Open Wiktionary"
            >
              Wiktionary{" "}
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 3h7v7M21 3 10 14M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6" />
              </svg>
            </button>
          </div>
          {lookup.term === term && lookup.error && (
            <div role="status">
              <p>{lookup.error}</p>
              <button onClick={() => setRetry((value) => value + 1)}>
                Retry dictionary lookup
              </button>
            </div>
          )}
          <div className="dictionary-entries">
            {readings.size ? (
              [...readings].map(([pinyin, meanings]) => (
                <div className="dictionary-entry" key={pinyin}>
                  {readings.size > 1 && <h3>{pinyin}</h3>}
                  <ul>
                    {meanings.map((meaning) => (
                      <li key={meaning}>
                        {dictionaryParts(meaning).map((part, index) =>
                          part.pinyin ? (
                            <span
                              key={index}
                              className="dictionary-example"
                              tabIndex={0}
                              aria-label={`${part.text}, ${part.pinyin}`}
                            >
                              {part.text}
                              <span
                                className="dictionary-pinyin-bubble"
                                aria-hidden="true"
                              >
                                {part.pinyin}
                              </span>
                            </span>
                          ) : (
                            part.text
                          ),
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="muted">
                {lookup.term !== term
                  ? "Looking up dictionary…"
                  : lookup.error
                    ? "Dictionary unavailable."
                    : "No dictionary entry found. Try Wiktionary."}
              </p>
            )}
          </div>
          {readings.size > 0 && (
            <p className="dictionary-source">
              Source:{" "}
              <a
                href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict"
                target="_blank"
                rel="noreferrer"
              >
                CC-CEDICT via MDBG
              </a>
            </p>
          )}
        </>
      )}
    </section>
  );
}
