import { useEffect, useState } from "react";
import type { Occurrence } from "../domain.ts";

export function TimingFields({
  cue,
  onApply,
}: {
  cue: Occurrence;
  onApply: (start: string, end: string) => void;
}) {
  const [start, setStart] = useState(String(cue.startMs ?? "")),
    [end, setEnd] = useState(String(cue.endMs ?? ""));
  useEffect(() => {
    setStart(String(cue.startMs ?? ""));
    setEnd(String(cue.endMs ?? ""));
  }, [cue.id, cue.startMs, cue.endMs]);
  return (
    <form
      noValidate
      className="timing-fields"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(start, end);
      }}
    >
      <label>
        Start (ms)
        <input
          aria-label="Start milliseconds"
          type="number"
          step="1"
          min="0"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label>
        End (ms)
        <input
          aria-label="End milliseconds"
          type="number"
          step="1"
          min="0"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      <button type="submit">Apply timing</button>
    </form>
  );
}
