import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../domain";
import { useEditorHistory, type EditorHistory } from "../useEditorHistory";
import { LyricsEditor } from "./LyricsEditor";
import { parseLines, projectDocument, type Line } from "./lyrics-document";

export function ProjectStructure({
  project,
  selectedId,
  publishHistory,
  apply,
  cancel,
}: {
  project: Project;
  publishHistory: (h: EditorHistory | null) => void;
  selectedId?: string;
  apply: (p: Project) => void;
  cancel: () => void;
}) {
  const [base, setBase] = useState(() => projectDocument(project));
  const [lines, setLines] = useState(base),
    editor = useRef<HTMLTextAreaElement>(null);
  const { rows, groups, issues } = parseLines(lines);
  const original = parseLines(base);
  const current = useMemo(() => projectDocument(project), [project]);
  const stableIds = new Set([
    ...project.occurrences.map((o) => o.id),
    ...(project.lyricGroups ?? []).map((g) => g.id),
  ]);
  const changed =
    base.map((l) => l.text).join("\n") !==
      current.map((l) => l.text).join("\n") ||
    base.some(
      (line, i) => stableIds.has(current[i]?.id) && line.id !== current[i]?.id,
    );
  const unsafe =
    new Set(base.map((l) => l.id)).size !== base.length ||
    original.rows.length !== project.occurrences.length ||
    (!changed &&
      original.rows.some((row, i) => row.id !== project.occurrences[i]?.id)) ||
    original.issues.some((i) => !i.count);
  const same =
    rows.length === original.rows.length &&
    rows.every((r, i) => r.text === original.rows[i].text);
  const past = useRef<Line[][]>([]),
    future = useRef<Line[][]>([]);
  useEffect(() => {
    // A pending audio insertion can update the project while Import is open.
    // Refresh a clean editor and let the existing conflict warning protect edits.
    if (!changed || lines !== base) return;
    past.current = [];
    future.current = [];
    setBase(current);
    setLines(current);
  }, [changed, lines, base, current]);
  function history(redo: boolean) {
    const from = redo ? future : past,
      to = redo ? past : future,
      next = from.current.pop();
    if (next) {
      to.current.push(lines);
      setLines(next);
    }
  }
  useEditorHistory(
    past.current.length > 0 || future.current.length > 0,
    past.current.length > 0,
    future.current.length > 0,
    history,
    publishHistory,
  );
  return (
    <section>
      <p>
        Edit section headings and use [/] to return to ungrouped lyrics.
        Existing lyric lines keep their translations and timings.
      </p>
      <LyricsEditor
        existing
        wordChoices={
          new Map(
            project.phrases.map((phrase) => [phrase.lyricKey, phrase.words]),
          )
        }
        initialLine={Math.max(
          0,
          base.findIndex((l) => l.id === selectedId),
        )}
        lines={lines}
        editor={editor}
        change={(next) => {
          past.current.push(lines);
          future.current = [];
          setLines(next);
        }}
        history={history}
      />
      {(!same || changed || unsafe) && (
        <p role="alert">
          {unsafe
            ? "This project’s membership or text cannot be represented losslessly. Use Timing to edit its groups."
            : changed
              ? "The project structure changed. Cancel and reopen to use the latest version."
              : "Keep existing lyric text and order to preserve timings and translations."}
        </p>
      )}
      <button
        disabled={!same || changed || unsafe || issues.some((i) => !i.count)}
        onClick={() => {
          const ids = new Map(
            rows.map((r, i) => [r.id, project.occurrences[i].id]),
          );
          const used = new Set(groups.map((g) => g.id));
          apply({
            ...project,
            lyricGroups: groups.map((g) => {
              const members = g.occurrenceIds.map((id) => ids.get(id)!);
              const old = project.lyricGroups?.find(
                (group) =>
                  !used.has(group.id) && group.occurrenceIds[0] === members[0],
              );
              return {
                id: old?.id ?? g.id,
                name: g.name,
                occurrenceIds: members,
              };
            }),
          });
        }}
      >
        Apply and return to Timing
      </button>
      <button onClick={cancel}>Cancel</button>
    </section>
  );
}
