import { useEffect, useMemo, useRef, useState } from "react";
import type { Phrase, Project, Word } from "../domain";
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
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");
  const [convertedRows, setConvertedRows] = useState<Map<string, string>>();
  const [convertedPhrases, setConvertedPhrases] =
    useState<Map<string, Phrase>>();
  const [convertedRefinements, setConvertedRefinements] =
    useState<Map<string, string>>();

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
    rows.every(
      (r, i) =>
        r.text === original.rows[i].text ||
        (convertedRows?.has(original.rows[i].text) &&
          r.text === convertedRows.get(original.rows[i].text)),
    );
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

  async function convertCharacters() {
    setConverting(true);
    setError("");
    try {
      const lineTexts = lines.map((l) => l.text);
      const uniqueWordHanzis = Array.from(
        new Set(project.phrases.flatMap((p) => p.words.map((w) => w.hanzi))),
      );
      const uniqueLyricKeys = Array.from(
        new Set(project.phrases.map((p) => p.lyricKey)),
      );
      const uniqueRefinements = Array.from(
        new Set(
          project.occurrences
            .map((o) => o.refinement?.text)
            .filter((t): t is string => Boolean(t)),
        ),
      );
      const uniqueGroupNames = Array.from(
        new Set((project.lyricGroups ?? []).map((g) => g.name)),
      );

      const payloadStrings = [
        ...lineTexts,
        ...uniqueWordHanzis,
        ...uniqueLyricKeys,
        ...uniqueRefinements,
        ...uniqueGroupNames,
      ];

      const response = await fetch("/api/convert-characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: payloadStrings }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw Error(
          err?.error ||
            (response.status === 404
              ? "Conversion endpoint unavailable. Restart the workbench development server."
              : `Could not convert characters (${response.status}).`),
        );
      }
      const data = await response.json();
      if (!Array.isArray(data.lines))
        throw Error("Could not convert characters.");
      if (data.lines.length !== payloadStrings.length)
        throw Error("Character conversion returned invalid lyric lines.");

      let cursor = 0;
      const convertedLines = data.lines.slice(
        cursor,
        cursor + lineTexts.length,
      );
      cursor += lineTexts.length;
      const convertedHanzis = data.lines.slice(
        cursor,
        cursor + uniqueWordHanzis.length,
      );
      cursor += uniqueWordHanzis.length;
      const convertedLyricKeys = data.lines.slice(
        cursor,
        cursor + uniqueLyricKeys.length,
      );
      cursor += uniqueLyricKeys.length;
      const convertedRefinementsList = data.lines.slice(
        cursor,
        cursor + uniqueRefinements.length,
      );
      cursor += uniqueRefinements.length;

      const hanziMap = new Map(
        uniqueWordHanzis.map((h, i) => [h, convertedHanzis[i]]),
      );
      const lyricKeyMap = new Map(
        uniqueLyricKeys.map((k, i) => [k, convertedLyricKeys[i]]),
      );
      const refinementMap = new Map(
        uniqueRefinements.map((r, i) => [r, convertedRefinementsList[i]]),
      );

      const rowConversionMap = new Map<string, string>();
      original.rows.forEach((row) => {
        const converted = lyricKeyMap.get(row.text);
        if (converted) rowConversionMap.set(row.text, converted);
      });

      const phraseMap = new Map<string, Phrase>();
      for (const phrase of project.phrases) {
        phraseMap.set(phrase.id, {
          ...phrase,
          lyricKey: lyricKeyMap.get(phrase.lyricKey) ?? phrase.lyricKey,
          words: phrase.words.map((w) => ({
            ...w,
            hanzi: hanziMap.get(w.hanzi) ?? w.hanzi,
          })),
        });
      }

      setConvertedRows(rowConversionMap);
      setConvertedPhrases(phraseMap);
      setConvertedRefinements(refinementMap);

      const nextLines = lines.map((line, idx) => ({
        ...line,
        text: convertedLines[idx],
      }));
      past.current.push(lines);
      future.current = [];
      setLines(nextLines);
      requestAnimationFrame(() => editor.current?.focus());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not convert characters.",
      );
    } finally {
      setConverting(false);
    }
  }

  const wordChoices = useMemo(() => {
    const choices = new Map<string, Word[]>();
    for (const phrase of project.phrases) {
      choices.set(phrase.lyricKey, phrase.words);
    }
    if (convertedPhrases) {
      for (const phrase of convertedPhrases.values()) {
        choices.set(phrase.lyricKey, phrase.words);
      }
    }
    return choices;
  }, [project.phrases, convertedPhrases]);

  return (
    <section>
      <p>
        Edit section headings and use [/] to return to ungrouped lyrics.
        Existing lyric lines keep their translations and timings.
      </p>
      <LyricsEditor
        existing
        wordChoices={wordChoices}
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
        editorAction={
          <button
            type="button"
            disabled={
              converting ||
              !lines.some((line) => /[\u3400-\u9fff]/u.test(line.text))
            }
            onClick={() => void convertCharacters()}
          >
            {converting ? "Converting…" : "Convert to Simplified"}
          </button>
        }
      />
      {error && <p role="alert">{error}</p>}
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
          const isConverted = rows.some(
            (r, i) =>
              convertedRows?.has(original.rows[i].text) &&
              r.text === convertedRows.get(original.rows[i].text) &&
              r.text !== original.rows[i].text,
          );

          const updatedLyricGroups = groups.map((g) => {
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
          });

          if (!isConverted || !convertedPhrases) {
            apply({
              ...project,
              lyricGroups: updatedLyricGroups,
            });
            return;
          }

          const updatedPhrases = project.phrases.map((phrase) => {
            const converted = convertedPhrases.get(phrase.id);
            return converted ?? phrase;
          });

          const updatedOccurrences = project.occurrences.map((o) => {
            if (!o.refinement?.text) return o;
            const convertedText = convertedRefinements?.get(o.refinement.text);
            return convertedText
              ? { ...o, refinement: { ...o.refinement, text: convertedText } }
              : o;
          });

          const updatedBaseline = project.timingBaseline?.map((o) => {
            if (!o.refinement?.text) return o;
            const convertedText = convertedRefinements?.get(o.refinement.text);
            return convertedText
              ? { ...o, refinement: { ...o.refinement, text: convertedText } }
              : o;
          });

          apply({
            ...project,
            phrases: updatedPhrases,
            occurrences: updatedOccurrences,
            ...(updatedBaseline ? { timingBaseline: updatedBaseline } : {}),
            lyricGroups: updatedLyricGroups,
          });
        }}
      >
        Apply and return to Timing
      </button>
      <button onClick={cancel}>Cancel</button>
    </section>
  );
}
