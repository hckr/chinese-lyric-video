import { useEffect, useRef, useState } from "react";
import { linePinyin, type Project } from "./domain.ts";

export function RepeatLyricDialog({
  phrases,
  initialId,
  onCancel,
  onConfirm,
}: {
  phrases: Project["phrases"];
  initialId?: string;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(initialId ?? phrases[0]?.id ?? "");
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="remove-dialog repeat-lyric-dialog"
      aria-labelledby="repeat-title"
      onCancel={onCancel}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (selected) onConfirm(selected);
        }}
      >
        <h2 id="repeat-title">Repeat a lyric</h2>
        <p>
          Copy the original appearance’s timing and shared translation. The
          overlap warning is expected; move the repeat on the timeline.
        </p>
        <label>
          Lyric
          <select
            autoFocus
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {phrases.map((phrase) => (
              <option key={phrase.id} value={phrase.id}>
                {phrase.lyricKey}
                {linePinyin(phrase) ? ` (${linePinyin(phrase)})` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="remove-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary" disabled={!selected}>
            Add repeat
          </button>
        </div>
      </form>
    </dialog>
  );
}
