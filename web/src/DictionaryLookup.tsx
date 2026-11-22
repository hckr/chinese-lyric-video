import { useEffect, useState } from "react";
import {
  lookupDictionary,
  type DictionaryEntry,
} from "./dictionary-service.ts";
import { dictionaryParts } from "./dictionary-text.ts";
import { readingParts } from "./reading-parts.ts";
import { fixSpacing, type Word } from "./domain.ts";

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
    provider?: import("./WordReview").WordProvider;
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
  const readings = new Map<string, string[]>();
  for (const entry of references) {
    if (entry.hanzi !== word?.hanzi) continue;
    readings.set(entry.pinyin, [
      ...new Set([...(readings.get(entry.pinyin) ?? []), ...entry.meanings]),
    ]);
  }
  const reading = word?.pinyin || readings.keys().next().value;
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
                    [...readings.keys()].find(
                      (p) => fixSpacing(p) === fixSpacing(reading),
                    ) ?? reading,
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
                      (p) => fixSpacing(p) === fixSpacing(reading),
                    ) && <span>{reading}</span>}
                </>
              )}
              {readings.size === 1 &&
                reading &&
                fixSpacing([...readings.keys()][0]) === fixSpacing(reading) && (
                  <small className="reading-status">
                    {word.pinyin ? "Selected" : "Default"}
                  </small>
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
          <div className="dictionary-entries">
            {readings.size ? (
              [...readings].map(([pinyin, meanings]) => (
                <div className="dictionary-entry" key={pinyin}>
                  {(readings.size > 1 ||
                    (onPick &&
                      fixSpacing(pinyin) !== fixSpacing(reading ?? ""))) && (
                    <div className="reading-heading">
                      <h3>{pinyin}</h3>{" "}
                      {reading &&
                        fixSpacing(pinyin) === fixSpacing(reading) && (
                          <small className="reading-status">
                            {word.pinyin ? "Selected" : "Default"}
                          </small>
                        )}
                      {onPick &&
                        fixSpacing(pinyin) !== fixSpacing(reading ?? "") && (
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
