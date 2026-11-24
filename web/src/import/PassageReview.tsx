import { lyricCount, lyricLimit } from "../lyric-length";
import { useVisibleWords } from "../useVisibleWords";
import { useState, useRef, useContext, useEffect } from "react";
import {
  chosenTiming,
  differenceType,
  type Passage,
  wordsKey,
  type Choice,
  type Edition,
} from "./reconcile";
import type { EditionTiming } from "./edition-cues";
import { validPieces, suggestPieces } from "../lyric-length";
import type { WordProvider } from "../translations/WordReview";
import { EditionReading, ReadingContext } from "./EditionReading";

export function PassageReview({
  blocks: initialBlocks,
  editions,
  hiddenIds,
  focusPassage,
  fingerprint,
  provider,
  apply,
}: {
  blocks: Passage[];
  editions: Edition[];
  hiddenIds: number[];
  focusPassage: (ms: number) => void;
  fingerprint: string;
  provider?: WordProvider;
  apply: (timing: EditionTiming) => void;
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [choices, setChoices] = useState<Choice[]>(() =>
    blocks.map((b) => ({
      edition: 0,
      text: b.variants[0].map((l) => l.text).join("\n"),
      useStarts: true,
    })),
  );
  const needsSplit = (text: string) =>
    text.split("\n").some((line) => lyricCount(line) > lyricLimit);
  const first = blocks.findIndex(
    (b, i) => b.different || needsSplit(choices[i].text),
  );
  const [at, setAt] = useState(first < 0 ? 0 : first),
    [all, setAll] = useState(false),
    [includeHidden, setIncludeHidden] = useState(false),
    [status, setStatus] = useState(""),
    [proposal, setProposal] = useState<string[]>();
  const history = useRef<
    { choices: Choice[]; blocks: Passage[]; at: number }[]
  >([]);
  function remember() {
    history.current.push({ choices, blocks, at });
  }
  const readings = useContext(ReadingContext);
  const proposedReadings = useVisibleWords(readings ? (proposal ?? []) : []);
  const version = useRef(0);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  const eligible = (index: number) =>
    index === 0 ||
    includeHidden ||
    !hiddenIds.includes(editions[index].credit.id);
  const availableBlocks = blocks.map((b) => ({
    ...b,
    variants: b.variants.map((v, i) => (eligible(i) ? v : [])),
  }));
  const result = () =>
    chosenTiming(availableBlocks, choices, editions, fingerprint);
  const block = blocks[at],
    choice = choices[at];
  function move(index: number) {
    version.current++;
    setProposal(undefined);
    setStatus("");
    setAt(index);
    const start = blocks[index]?.variants.find(
      (rows, i) => eligible(i) && rows[0]?.startMs !== undefined,
    )?.[0]?.startMs;
    if (start !== undefined) focusPassage(start);
  }
  function change(patch: Partial<Choice>) {
    remember();
    version.current++;
    setProposal(undefined);
    setStatus("");
    setChoices((c) =>
      c.map((v, i) =>
        i === at
          ? {
              ...v,
              ...(patch.text !== undefined || patch.timingEdition !== undefined
                ? { boundaryChoices: undefined }
                : {}),
              ...patch,
            }
          : v,
      ),
    );
  }
  if (!block)
    return (
      <section>
        <p>
          Song review complete · {choices.filter((c) => c.text).length} passages
        </p>
        <button onClick={() => move(Math.max(0, at - 1))}>Back</button>
        <button
          disabled={!choices.some((c) => c.text.trim())}
          onClick={() => apply(result())}
        >
          Use reconciled lyrics
        </button>
      </section>
    );
  const variants = new Map<string, number[]>();
  block.variants.forEach((lines, i) => {
    if (!eligible(i)) return;
    const key = lines.map((l) => wordsKey(l.text)).join("\n");
    variants.set(key, [...(variants.get(key) ?? []), i]);
  });
  const indices = blocks.flatMap((b, i) =>
    all ||
    needsSplit(choices[i].text) ||
    b.variants.some(
      (v, j) =>
        eligible(j) &&
        !["Same words and breaks", "Different timing"].includes(
          differenceType(b.variants[0], v),
        ),
    ) ||
    i === at
      ? [i]
      : [],
  );
  function shiftLine(edition: number, bring: boolean) {
    remember();
    const adjusted = blocks.map((b, i) =>
      i !== at && i !== at + 1
        ? b
        : { ...b, variants: b.variants.map((v) => [...v]) },
    );
    const current = adjusted[at].variants[edition],
      next = adjusted[at + 1].variants[edition];
    if (bring) current.push(next.shift()!);
    else next.unshift(current.pop()!);
    for (const index of [at, at + 1])
      adjusted[index].different = adjusted[index].variants.some(
        (v) =>
          v.map((l) => wordsKey(l.text)).join("\n") !==
          adjusted[index].variants[0].map((l) => wordsKey(l.text)).join("\n"),
      );
    setBlocks(adjusted);
    setChoices((list) =>
      list.map((v, i) =>
        (i === at || i === at + 1) && v.edition === edition
          ? {
              ...v,
              text: adjusted[i].variants[edition].map((l) => l.text).join("\n"),
            }
          : v,
      ),
    );
    move(at);
  }
  async function ask() {
    if (!provider) return;
    const serial = ++version.current;
    setStatus("Requesting split…");
    const text = choice.text.split("\n").join("");
    try {
      const r = await fetch("/api/suggest-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...provider,
          occurrences: [text],
          splitContext: {
            previous: choices[at - 1]?.text,
            next: choices[at + 1]?.text,
            alternatives: block.variants.map((v) => v.map((l) => l.text)),
          },
        }),
      });
      if (!r.ok) throw Error();
      const data = await r.json();
      if (serial !== version.current) return;
      const pieces = data.phrases?.find(
        (p: { start: number; end: number }) => p.start === 1 && p.end === 1,
      )?.pieces;
      if (
        !Array.isArray(pieces) ||
        !pieces.every((p) => typeof p === "string" && !/[\r\n]/.test(p)) ||
        !validPieces(text, pieces)
      ) {
        setStatus("No valid alternative split returned.");
        return;
      }
      setProposal(pieces);
      setStatus("");
    } catch {
      if (serial === version.current)
        setStatus("Split suggestion unavailable. Edit the breaks below.");
    }
  }
  return (
    <section>
      <h3>
        Review differences · passage {at + 1} of {blocks.length}
      </h3>
      <button
        disabled={!history.current.length}
        onClick={() => {
          const entry = history.current.pop();
          if (entry) {
            setChoices(entry.choices);
            setBlocks(entry.blocks);
            move(entry.at);
          }
        }}
      >
        Undo passage edit
      </button>
      <label>
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => setAll(e.target.checked)}
        />{" "}
        Include matching passages
      </label>
      {hiddenIds.length > 0 && (
        <label>
          <input
            type="checkbox"
            checked={includeHidden}
            onChange={(e) => setIncludeHidden(e.target.checked)}
          />{" "}
          Include hidden editions
        </label>
      )}
      <button
        disabled={!choices.some((c) => c.text.trim())}
        onClick={() => apply(result())}
      >
        Use reconciled lyrics
      </button>
      {needsSplit(choice.text) && (
        <div>
          <span>Split long lines to fit the 11-element limit.</span>
          <button
            onClick={() =>
              change({
                text: choice.text
                  .split("\n")
                  .flatMap((t) => suggestPieces(t))
                  .join("\n"),
              })
            }
          >
            Split to fit
          </button>
        </div>
      )}
      <div className="edition-grid">
        <article>
          <h4>A · Reference passage</h4>
          {block.variants[0].map((line, i) => (
            <div key={i}>
              <EditionReading text={line.text} />
            </div>
          ))}
        </article>
        <article>
          <h4>B · Passage alternatives</h4>
          {variants.size > 1 &&
            Array.from(variants.values()).map((ids) => {
              const i = ids[0],
                lines = block.variants[i];
              return (
                <div key={i}>
                  <strong>{differenceType(block.variants[0], lines)} ·</strong>
                  {lines.length ? (
                    lines.map((l, k) => (
                      <div key={k}>
                        <EditionReading
                          text={l.text}
                          compare={
                            i !== 0
                              ? (block.variants[0][k]?.text ?? "")
                              : undefined
                          }
                        />
                      </div>
                    ))
                  ) : (
                    <p>Passage omitted</p>
                  )}
                  <button
                    onClick={() =>
                      change({
                        edition: i,
                        text: lines.map((l) => l.text).join("\n"),
                      })
                    }
                  >
                    Use this wording
                  </button>
                  <details>
                    <summary>{ids.length} supporting editions</summary>
                    {ids.map((j) => (
                      <div key={j}>
                        <button
                          onClick={() =>
                            change({
                              edition: j,
                              text: block.variants[j]
                                .map((l) => l.text)
                                .join("\n"),
                            })
                          }
                        >
                          Use LRCLIB {editions[j].credit.id}
                        </button>
                      </div>
                    ))}
                  </details>
                </div>
              );
            })}

          {variants.size <= 1 && <p>Same wording and line breaks.</p>}
        </article>
      </div>
      <details>
        <summary>Edit passage</summary>
        <details>
          <summary>Adjust passage alignment</summary>
          {editions.slice(1).map((e, k) => {
            const j = k + 1;
            return (
              <p key={e.credit.id}>
                LRCLIB {e.credit.id}{" "}
                <button
                  disabled={
                    at + 1 >= blocks.length || !block.variants[j].length
                  }
                  onClick={() => shiftLine(j, false)}
                >
                  Move last line to next passage
                </button>{" "}
                <button
                  disabled={!blocks[at + 1]?.variants[j].length}
                  onClick={() => shiftLine(j, true)}
                >
                  Bring next line here
                </button>
              </p>
            );
          })}
        </details>
        <label>
          Passage wording and line breaks
          <textarea
            rows={3}
            value={choice.text}
            onChange={(e) => change({ text: e.target.value })}
          />
        </label>
        <button onClick={() => change({ text: "" })}>Omit passage</button>
        <button disabled={!provider || !choice.text} onClick={() => void ask()}>
          Suggest split with AI
        </button>{" "}
        <small>
          {provider
            ? provider.model
            : "Configure a suggestion provider in Review with AI."}
        </small>
        {proposal && (
          <div>
            <ReadingContext.Provider
              value={readings ? proposedReadings : undefined}
            >
              {proposal.map((p, i) => (
                <div key={i}>
                  <EditionReading text={p} />
                </div>
              ))}
            </ReadingContext.Provider>
            <button onClick={() => change({ text: proposal.join("\n") })}>
              Apply suggested breaks
            </button>
            <button onClick={() => setProposal(undefined)}>
              Keep current split
            </button>
          </div>
        )}
        <p role="status">{status}</p>
      </details>
      <button
        disabled={!indices.some((i) => i < at)}
        onClick={() => move(indices.filter((i) => i < at).at(-1)!)}
      >
        Previous difference
      </button>
      <button
        onClick={() => move(indices.find((i) => i > at) ?? blocks.length)}
      >
        {indices.some((i) => i > at) ? "Next difference" : "Finish review"}
      </button>
    </section>
  );
}
