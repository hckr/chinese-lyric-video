import { differenceType, passages } from "./reconcile";
import { PassageReview } from "./PassageReview";
import { EditionReading, ReadingContext } from "./EditionReading";
import { useVisibleWords } from "../useVisibleWords";
import type { WordProvider } from "../translations/WordReview";
import type { EditionTiming } from "./edition-cues";
import { useEffect, useMemo, useRef, useState } from "react";
import { cueTime, type SourceCue } from "./edition-cues";
import type { findLyrics, LyricCredit } from "./song-source";
type Edition = Awaited<ReturnType<typeof findLyrics>>[number];

function EditionCard({
  row,
  ms,
  syncScroll,
  expanded,
  reviewed,
  toggleReviewed,
  summary,
  slot,
  chooseA,
  chooseB,
  seek,
  apply,
}: {
  row: Edition;
  ms: number;
  syncScroll: (element: HTMLDivElement) => void;
  expanded: boolean;
  reviewed: boolean;
  toggleReviewed: () => void;
  summary: string;
  slot: string;
  chooseA: () => void;
  chooseB: () => void;
  seek: (ms: number) => void;
  apply: () => void;
}) {
  const { cues, credit } = row;
  const active = cues.reduce(
    (index, c, i) => (c.startMs <= ms ? i : index),
    -1,
  );
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(
      '[aria-current="true"]',
    );
    if (el && list.current)
      list.current.scrollTop = el.offsetTop - list.current.clientHeight / 3;
  }, [active, expanded]);
  return (
    <article data-reviewed={reviewed}>
      <header>
        <strong>
          {slot && slot + " · "}
          {credit.track}
        </strong>
        <button onClick={apply}>Use this edition</button>
      </header>
      <p>
        {credit.artist} · {cueTime(credit.duration * 1000)} ·{" "}
        {cues.length ? "Synced" : "Plain text"} ·{" "}
        <a href={credit.url} target="_blank" rel="noreferrer">
          LRCLIB {credit.id}
        </a>
      </p>
      {summary && <p>{summary}</p>}
      {reviewed && <p className="muted">Hidden</p>}
      {cues.length > 0 ? (
        <div className="edition-context">
          <small>
            <EditionReading text={cues[active - 1]?.text ?? ""} />
          </small>
          <strong>
            {active < 0 ? (
              "Starts at " + cueTime(cues[0].startMs)
            ) : cues[active].text ? (
              <EditionReading text={cues[active].text} />
            ) : (
              "Instrumental break"
            )}
          </strong>
          <small>
            <EditionReading text={cues[active + 1]?.text ?? ""} />
          </small>
        </div>
      ) : (
        <div className="edition-context">
          <small>No playback timestamps</small>
        </div>
      )}
      <button disabled={slot === "A"} onClick={chooseA}>
        Set as A
      </button>{" "}
      <button disabled={slot === "B"} onClick={chooseB}>
        Compare in B
      </button>
      <button onClick={toggleReviewed}>{reviewed ? "Show" : "Hide"}</button>
      {expanded && (
        <div
          className="edition-transcript"
          ref={list}
          onScroll={(event) => syncScroll(event.currentTarget)}
        >
          {cues.length
            ? cues.map((c, i) => (
                <button
                  key={i}
                  aria-current={i === active}
                  onClick={() => seek(c.startMs)}
                >
                  <time>{cueTime(c.startMs)}</time>{" "}
                  <span>
                    <EditionReading text={c.text || "—"} />
                  </span>
                </button>
              ))
            : row.text
                .split(/\r?\n/)
                .filter((line) => line.trim())
                .map((line, i) => (
                  <div className="edition-plain-line" key={i}>
                    <span aria-hidden="true">—</span>
                    <span>
                      <EditionReading text={line} />
                    </span>
                  </div>
                ))}
        </div>
      )}
    </article>
  );
}
export function EditionComparison({
  reviewed,
  setReviewed,
  rows,
  fingerprint,
  provider,
  file,
  apply,
  close,
}: {
  reviewed: number[];
  setReviewed: (update: (ids: number[]) => number[]) => void;
  rows: Edition[];
  fingerprint: string;
  provider?: WordProvider;
  file: File;
  apply: (
    text: string,
    credit: LyricCredit,
    cues: SourceCue[],
    timing?: EditionTiming,
  ) => void;
  close: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const comparisonGrid = useRef<HTMLDivElement>(null);
  const linkedPosition = useRef(new WeakMap<HTMLDivElement, number>());
  function syncScroll(source: HTMLDivElement) {
    const expected = linkedPosition.current.get(source);
    linkedPosition.current.delete(source);
    if (!video.current?.paused || expected === source.scrollTop) return;
    const target = [
      ...(comparisonGrid.current?.querySelectorAll<HTMLDivElement>(
        ".edition-transcript",
      ) ?? []),
    ].find((panel) => panel !== source);
    if (!target) return;
    const rows = [...source.children] as HTMLElement[];
    const index = rows.findIndex(
      (row) => row.offsetTop + row.offsetHeight > source.scrollTop,
    );
    const from = rows[index],
      to = target.children[index] as HTMLElement | undefined;
    if (!from || !to || !from.offsetHeight) return;
    const progress = (source.scrollTop - from.offsetTop) / from.offsetHeight;
    const previous = target.scrollTop;
    target.scrollTop = to.offsetTop + progress * to.offsetHeight;
    if (target.scrollTop !== previous)
      linkedPosition.current.set(target, target.scrollTop);
  }

  const [ms, setMs] = useState(0),
    [preferredSlots, setPreferredSlots] = useState<(number | undefined)[]>(
      () => [rows[0]?.credit.id, rows[1]?.credit.id],
    );
  useEffect(() => {
    const element = video.current!,
      url = URL.createObjectURL(file);
    element.src = url;
    return () => {
      element.pause();
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(url);
    };
  }, [file]);
  const available = rows
    .filter((row) => !reviewed.includes(row.credit.id))
    .map((row) => row.credit.id);
  const expanded = preferredSlots.map((id) =>
    id !== undefined && available.includes(id) ? id : undefined,
  );
  if (expanded[0] === undefined && expanded[1] !== undefined) {
    [expanded[0], expanded[1]] = [expanded[1], undefined];
  }
  for (let index = 0; index < expanded.length; index++) {
    expanded[index] ??= available.find((id) => !expanded.includes(id));
  }
  const orderedCards = [
    ...expanded.flatMap((id) => rows.filter((row) => row.credit.id === id)),
    ...rows.filter((r) => !expanded.includes(r.credit.id)),
  ];
  const displayed = [
    ...orderedCards.filter((row) => !reviewed.includes(row.credit.id)),
    ...reviewed
      .map((id) => orderedCards.find((row) => row.credit.id === id))
      .filter((row) => row !== undefined),
  ];
  const [showPinyin, setShowPinyin] = useState(true),
    [review, setReview] = useState(false),
    [reviewStarted, setReviewStarted] = useState(false);
  const reference = expanded[0] ?? expanded[1] ?? rows[0].credit.id;
  const ordered = useMemo(
    () => [
      rows.find((r) => r.credit.id === reference)!,
      ...rows.filter((r) => r.credit.id !== reference),
    ],
    [rows, reference],
  );
  const blocks = useMemo(() => passages(ordered), [ordered]);
  const summaries = useMemo(
    () =>
      ordered.map((_, i) => {
        if (!i) return "Reference edition";
        const counts = new Map<string, number>();
        for (const b of blocks) {
          const name = differenceType(b.variants[0], b.variants[i]);
          if (name !== "Same words and breaks")
            counts.set(name, (counts.get(name) ?? 0) + 1);
        }
        const referenceCues = ordered[0].cues;
        const cues = ordered[i].cues;
        const textMatches = [...counts.keys()].every(
          (name) => name === "Different timing",
        );
        const summary = textMatches
          ? "Same words and line breaks as A"
          : [...counts].map(([name, n]) => name + " · " + n).join(" / ");
        if (!referenceCues.length || !cues.length)
          return summary + " · Timing unavailable";
        if (!textMatches) return summary;
        const sameTiming =
          !counts.size &&
          cues.length === referenceCues.length &&
          cues.every(
            (cue, index) =>
              cue.startMs === referenceCues[index].startMs &&
              Boolean(cue.text.trim()) ===
                Boolean(referenceCues[index].text.trim()),
          );
        return (
          summary +
          (sameTiming ? " · Same timestamps" : " · Different timestamps")
        );
      }),
    [ordered, blocks],
  );
  const dictionary = useVisibleWords(
    showPinyin
      ? rows
          .flatMap((row) => row.text.split("\n"))
          .filter((t) => /\p{Script=Han}/u.test(t))
      : [],
  );
  function setSlot(id: number, index: number) {
    setReviewed((ids) => ids.filter((value) => value !== id));
    const otherSlot = 1 - index;
    const other =
      expanded[otherSlot] === id ? expanded[index] : expanded[otherSlot];
    setPreferredSlots((slots) =>
      slots.map((previous, slot) =>
        slot === index
          ? id
          : (other ?? (previous === id ? undefined : previous)),
      ),
    );
  }
  return (
    <ReadingContext.Provider value={showPinyin ? dictionary : undefined}>
      <section className="edition-comparison">
        <header>
          <h2>Compare lyric editions</h2>
          <button onClick={close}>Back to editor</button>
        </header>
        <video
          controls
          preload="metadata"
          ref={video}
          onTimeUpdate={(e) => setMs(e.currentTarget.currentTime * 1000)}
          onSeeking={(e) => setMs(e.currentTarget.currentTime * 1000)}
        />
        <label>
          <input
            type="checkbox"
            checked={showPinyin}
            onChange={(e) => setShowPinyin(e.target.checked)}
          />{" "}
          Show Pinyin
        </label>
        <button
          onClick={() => {
            setReviewStarted(true);
            setReview(!review);
          }}
        >
          {review ? "Return to editions" : "Review differences"}
        </button>
        {(!review || expanded.some((id) => id !== undefined)) && (
          <div
            className="edition-grid"
            data-single-visible={available.length === 1}
            ref={comparisonGrid}
          >
            {displayed
              .filter((row) => !review || expanded.includes(row.credit.id))
              .map((row) => (
                <EditionCard
                  key={row.credit.id}
                  row={row}
                  summary={summaries[ordered.indexOf(row)]}
                  ms={ms}
                  syncScroll={syncScroll}
                  reviewed={reviewed.includes(row.credit.id)}
                  toggleReviewed={() =>
                    setReviewed((ids) =>
                      ids.includes(row.credit.id)
                        ? ids.filter((id) => id !== row.credit.id)
                        : [...ids, row.credit.id],
                    )
                  }
                  expanded={
                    expanded.includes(row.credit.id) &&
                    !reviewed.includes(row.credit.id)
                  }
                  slot={
                    expanded[0] === row.credit.id
                      ? "A"
                      : expanded[1] === row.credit.id
                        ? "B"
                        : ""
                  }
                  chooseA={() => setSlot(row.credit.id, 0)}
                  chooseB={() => setSlot(row.credit.id, 1)}
                  seek={(t) => {
                    if (video.current) {
                      video.current.currentTime = t / 1000;
                      setMs(t);
                    }
                  }}
                  apply={() => apply(row.text, row.credit, row.cues)}
                />
              ))}
          </div>
        )}
        {reviewStarted && (
          <div hidden={!review}>
            <PassageReview
              key={reference}
              blocks={blocks}
              hiddenIds={reviewed}
              focusPassage={(ms) => {
                if (video.current) video.current.currentTime = ms / 1000;
                setMs(ms);
              }}
              editions={ordered}
              fingerprint={fingerprint}
              provider={provider}
              apply={(timing) =>
                apply(
                  timing.pieces.map((p) => p.text).join("\n"),
                  ordered.find((e) => e.credit.id === timing.editionId)!.credit,
                  timing.cues,
                  timing,
                )
              }
            />
          </div>
        )}
      </section>
    </ReadingContext.Provider>
  );
}
