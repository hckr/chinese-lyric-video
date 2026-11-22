import { useLayoutEffect, useRef } from "react";

export type EditorHistory = { undo?: () => void; redo?: () => void };

// The header controls the visible document transaction history while editing.
export function useEditorHistory(
  active: boolean,
  undoable: boolean,
  redoable: boolean,
  move: (redo: boolean) => void,
  publish: (actions: EditorHistory | null) => void,
) {
  const latest = useRef(move);
  latest.current = move;
  useLayoutEffect(() => {
    if (!active) return;
    publish({
      undo: undoable ? () => latest.current(false) : undefined,
      redo: redoable ? () => latest.current(true) : undefined,
    });
    return () => publish(null);
  }, [active, undoable, redoable, publish]);
}
