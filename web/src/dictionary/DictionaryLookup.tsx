import { useEffect, useState } from "react";
import {
  lookupDictionary,
  type DictionaryEntry,
} from "./dictionary-service.ts";
import { dictionaryParts } from "./dictionary-text.ts";
import { readingParts } from "../reading-parts.ts";
import type { Word } from "../domain.ts";
import {
  dictionaryReadings,
  isDictionaryIdiom,
  readingKey,
} from "./dictionary-readings.ts";

export function DictionaryLookup({
  word,
  onOpenWiktionary,
  entries,
  controls,
  onPick,
  advice,
}: {
  word?: Word;
  onOpenWiktionary?: (term: string) => void;
  entries?: DictionaryEntry[];
  controls?: import("react").ReactNode;
  onPick?: (entry: DictionaryEntry) => void;
  advice?: {
    provider?: import("../translations/WordReview").WordProvider;
    text: string;
    position: number;
    choices?: DictionaryEntry[];
  };
}) {
  const term = word?.hanzi ?? "";
  const [lookup, setLookup] = useState<{
    term: string;
    entries: DictionaryEntry[];
    error?: string;
  }>({ term: "", entries: [] });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!term || entries) return;
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
  }, [term, retry, entries]);
  const references =
    entries ?? (lookup.term === term && !lookup.error ? lookup.entries : []);
  const key = (value: string) => readingKey(term, value);
  const readings = new Map(
    dictionaryReadings(references.filter((entry) => entry.hanzi === term)).map(
      ({ pinyin, meanings }) => [pinyin, meanings] as const,
    ),
  );
  const reading = word?.pinyin || readings.keys().next().value;
  const match =
    reading &&
    [...readings.keys()].find((option) => key(option) === key(reading));
  const canFixSpacing =
    match &&
    match !== word?.pinyin &&
    !(
      isDictionaryIdiom(readings.get(match) ?? []) &&
      !/\s/u.test(match) &&
      /\s/u.test(word?.pinyin.trim() ?? "")
    );
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
                readingParts({
                  ...word,
                  pinyin:
                    [...readings.keys()].find((p) => key(p) === key(reading)) ??
                    reading,
                }).map((part, index) => (
                  <span className="dictionary-reading-part" key={index}>
                    <span>{part.pinyin}</span>
                    <strong lang="zh-Hans">{part.hanzi}</strong>
                  </span>
                ))
              ) : (
                <>
                  <strong lang="zh-Hans">{word.hanzi}</strong>
                  {reading &&
                    ![...readings.keys()].some(
                      (p) => key(p) === key(reading),
                    ) && <span>{reading}</span>}
                </>
              )}
              {readings.size === 1 && !word.pinyin && match && (
                <small className="reading-status">Default</small>
              )}
            </div>
            {onOpenWiktionary && (
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
            )}
          </div>
          {lookup.term === term && lookup.error && (
            <div role="status">
              <p>{lookup.error}</p>
              <button onClick={() => setRetry((value) => value + 1)}>
                Retry dictionary lookup
              </button>
            </div>
          )}
          {onPick && word.pinyin.trim() && readings.size > 0 && !match && (
            <p role="status" className="warning">
              This Pinyin is absent from the local dictionary alternatives. The
              dictionary may have incomplete coverage.
            </p>
          )}
          {onPick && word.pinyin && match && canFixSpacing && (
            <button
              onClick={() =>
                onPick({
                  hanzi: term,
                  pinyin: match,
                  meanings: readings.get(match) ?? [],
                })
              }
            >
              Fix spacing
            </button>
          )}
          <div className="dictionary-entries">
            {readings.size ? (
              [...readings].map(([pinyin, meanings]) => (
                <div className="dictionary-entry" key={pinyin}>
                  {(readings.size > 1 ||
                    (onPick && key(pinyin) !== key(reading ?? ""))) && (
                    <div className="reading-heading">
                      <h3>{pinyin}</h3>{" "}
                      {readings.size > 1 &&
                        reading &&
                        key(pinyin) === key(reading) && (
                          <small className="reading-status">
                            {word.pinyin ? "Selected" : "Default"}
                          </small>
                        )}
                      {onPick && key(pinyin) !== key(reading ?? "") && (
                        <button
                          onClick={() =>
                            onPick({ hanzi: term, pinyin, meanings })
                          }
                        >
                          Use {pinyin}
                        </button>
                      )}
                    </div>
                  )}
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
                {!entries && lookup.term !== term
                  ? "Looking up dictionary…"
                  : lookup.error
                    ? "Dictionary unavailable."
                    : "No dictionary entry found."}
              </p>
            )}
          </div>
        </>
      )}
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
      {controls}
      <footer className="dictionary-footer">
        {word?.hanzi && advice && (
          <ContextAdvice
            key={JSON.stringify([word.hanzi, advice, references])}
            advice={advice}
            choices={[...references, ...(advice.choices ?? [])]}
            term={term}
          />
        )}
      </footer>
    </section>
  );
}

function ContextAdvice({
  advice,
  choices,
  term,
}: {
  advice: NonNullable<Parameters<typeof DictionaryLookup>[0]["advice"]>;
  choices: DictionaryEntry[];
  term: string;
}) {
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  async function explain() {
    setBusy(true);
    setAnswer("");
    try {
      const response = await fetch("/api/suggest-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...advice.provider,
          wordContext: {
            text: advice.text,
            position: advice.position,
            term,
            choices,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.explanation?.trim())
        throw Error(
          data.error ||
            "No explanation returned. Retry or choose another model.",
        );
      setAnswer(data.explanation);
    } catch (error) {
      setAnswer(
        error instanceof Error
          ? error.message
          : "Word lookup failed. Retry the request.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button disabled={!advice.provider || busy} onClick={explain}>
        {busy ? "Requesting explanation…" : "Explain with AI"}
      </button>
      {answer && (
        <p className="word-explanation" role="status">
          {answer
            .split(/(\*\*[^*]+\*\*)/gu)
            .map((part, index) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={index}>{part.slice(2, -2)}</strong>
              ) : (
                part
              ),
            )}
        </p>
      )}
    </>
  );
}
