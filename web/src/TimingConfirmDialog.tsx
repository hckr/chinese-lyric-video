import { useEffect, useId, useRef, type ReactNode } from "react";

export function TimingConfirmDialog({
  title,
  children,
  action,
  trigger,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  action: string;
  trigger: HTMLButtonElement;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId(),
    descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger.isConnected && !trigger.disabled)
        trigger.focus({ preventScroll: true });
    };
  }, [trigger]);
  return (
    <dialog
      ref={ref}
      className="remove-dialog timing-confirm"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{children}</p>
      <div className="remove-dialog-actions">
        <button autoFocus onClick={onCancel}>
          Cancel
        </button>
        <button className="primary" onClick={onConfirm}>
          {action}
        </button>
      </div>
    </dialog>
  );
}
