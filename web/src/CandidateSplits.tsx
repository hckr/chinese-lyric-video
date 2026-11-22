import { useState } from "react";
import {
  proposedIntervals,
  type Candidate,
  type ReviewedPiece,
} from "./automatic-timing";
import { suggestPieces, lyricCount, validPieces } from "./lyric-length";

export function CandidateSplits({
  candidate: c,
  listen,
  add,
  cancel,
  disabled,
  audioReady,
  duration,
}: {
  candidate: Candidate;
  listen: (b: { startMs: number; endMs: number }) => void;
  add: (pieces: ReviewedPiece[]) => Promise<void>;
  cancel: () => void;
  disabled: boolean;
  audioReady: boolean;
  duration?: number;
}) {
  const [value, setValue] = useState(() => {
    const words = c.timedWords?.map((word) => word.text);
    const suggested = suggestPieces(c.text, words);
    // Prefer two balanced lines over a dangling character when transcript
    // boundaries provide valid times for both lines.
    if (
      suggested.length === 2 &&
      suggested.some((piece) => lyricCount(piece) === 1) &&
      words?.join("") === c.text
    ) {
      let best = suggested;
      let score = 1;
      let offset = 0;
      for (const word of words.slice(0, -1)) {
        offset += word.length;
        const pieces = [c.text.slice(0, offset), c.text.slice(offset)];
        const shortest = Math.min(...pieces.map(lyricCount));
        if (shortest <= score || !validPieces(c.text, pieces)) continue;
        const [first, second] = proposedIntervals(c, pieces);
        if (
          first.endMs === undefined ||
          second.startMs === undefined ||
          first.endMs <= c.startMs ||
          second.startMs >= c.endMs
        )
          continue;
        best = pieces;
        score = shortest;
      }
      return best.join("\n");
    }
    return suggested.join("\n");
  });
  const [changes, setChanges] = useState<Record<string, string>>({});
  const pieces = value.split("\n");
  const timed = proposedIntervals(c, pieces).map((p, i) => {
    const ms = (edge: "startMs" | "endMs") => {
      const custom = changes[i + edge];
      return custom === undefined
        ? (p[edge] ?? NaN)
        : custom.trim()
          ? Number(custom)
          : NaN;
    };
    return { text: p.text, startMs: ms("startMs"), endMs: ms("endMs") };
  });
  const valid =
    validPieces(c.text, pieces) &&
    timed.every(
      (p, i) =>
        Number.isSafeInteger(p.startMs) &&
        Number.isSafeInteger(p.endMs) &&
        p.startMs >= (timed[i - 1]?.endMs ?? c.startMs) &&
        p.endMs > p.startMs &&
        p.endMs <= c.endMs &&
        (duration === undefined || p.endMs <= duration),
    );
  return (
    <fieldset disabled={disabled}>
      <legend>Review splits</legend>
      <label>
        Spoken lines (one piece per line)
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setChanges({});
          }}
        />
      </label>
      {timed.map((piece, i) => (
        <div key={i}>
          <strong>
            {piece.text} · {lyricCount(piece.text)} / 11
          </strong>
          {(["startMs", "endMs"] as const).map((edge) => (
            <label key={edge}>
              {edge === "startMs" ? "Start" : "End"} milliseconds
              <input
                aria-label={edge + " " + (i + 1)}
                type="number"
                value={
                  changes[i + edge] ??
                  (Number.isFinite(piece[edge]) ? piece[edge] : "")
                }
                min={c.startMs}
                max={c.endMs}
                onChange={(e) =>
                  setChanges({ ...changes, [i + edge]: e.target.value })
                }
              />
            </label>
          ))}
          <button
            disabled={
              !audioReady ||
              !(
                piece.startMs >= c.startMs &&
                piece.endMs > piece.startMs &&
                piece.endMs <= c.endMs &&
                (duration === undefined || piece.endMs <= duration)
              )
            }
            onClick={() => listen(piece)}
          >
            Play piece
          </button>
        </div>
      ))}
      <button disabled={!valid || !audioReady} onClick={() => void add(timed)}>
        Add reviewed lines
      </button>{" "}
      <button onClick={cancel}>Cancel</button>
    </fieldset>
  );
}
