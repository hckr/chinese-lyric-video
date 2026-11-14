import { useEffect, useRef } from "react";

export function RemoveAppearanceDialog({
  lyric,
  last,
  onCancel,
  onConfirm,
}: {
  lyric: string;
  last: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="remove-dialog"
      aria-labelledby="remove-title"
      aria-describedby="remove-description"
      onCancel={onCancel}
    >
      <h2 id="remove-title">
        {last ? "Remove this lyric?" : "Remove this appearance?"}
      </h2>
      <p className="remove-lyric">{lyric}</p>
      <p id="remove-description">
        {last
          ? "This is its last appearance. Removing it also removes the lyric, translations and word breakdown."
          : "Other appearances and the shared translation will remain."}{" "}
        Undo can restore everything.
      </p>
      <div className="remove-dialog-actions">
        <button autoFocus onClick={onCancel}>
          Cancel
        </button>
        <button onClick={onConfirm}>
          {last ? "Remove lyric" : "Remove appearance"}
        </button>
      </div>
    </dialog>
  );
}
