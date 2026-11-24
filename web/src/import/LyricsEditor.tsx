import {
  fieldSelection,
  fieldText,
  paintLyricField,
  selectField,
  type LyricField,
} from "./lyric-field.ts";
import { wordSpans, inspectedWord } from "../word-spans";
import { useVisibleWords } from "../useVisibleWords";
import type { Word } from "../domain";
import {
  useLayoutEffect,
  useEffect,
  useRef,
  useId,
  useState,
  type CSSProperties,
  type RefObject,
  type ReactNode,
} from "react";
import {
  applyPatch,
  editLines,
  parseLines,
  patchIndex,
  type Line,
  type Patch,
} from "./lyrics-document";
import { readingParts } from "../reading-parts.ts";
import { alignedReadings } from "../translations/split-suggestions";
import {
  hasHanzi,
  lyricElements,
  lyricCount,
  suggestPieces,
  validPieces,
} from "../lyric-length";

type Annotation = {
  end: number;
  characters: number;
  reading: string;
  scale?: number;
  mobileScale?: number;
};

// Readings are centered over their Hanzi. Share the distance between centers
// according to the natural widths of both labels, leaving a clear syllable gap.
function fitReadings(text: string, annotations: Map<number, Annotation>) {
  let previous: Annotation | undefined;
  let previousEnd = 0;
  for (const [start, current] of annotations) {
    const gapWidth = [...text.slice(previousEnd, start)].reduce(
      (width, character) => width + (hasHanzi(character) ? 1.6 : 0.6),
      0,
    );
    function fit(em: number, key: "scale" | "mobileScale") {
      const width = current.reading.length * 6.1;
      if (!previous) {
        const leftRoom = (gapWidth + current.characters * 0.8 + 0.1) * em;
        current[key] = Math.min(1, (2 * leftRoom) / width);
        return;
      }
      const distance =
        ((previous.characters + current.characters) * 0.8 + gapWidth) * em;
      const scale = Math.min(
        1,
        (2 * (distance - 2)) / (width + previous.reading.length * 6.1),
      );
      previous[key] = Math.min(previous[key] ?? 1, scale);
      current[key] = scale;
    }
    fit(16, "scale");
    fit(14, "mobileScale");
    previous = current;
    previousEnd = current.end;
  }
}
function annotateSlice(
  text: string,
  offset: number,
  annotations: Map<number, Annotation>,
) {
  const parts: ReactNode[] = [];
  for (const char of text) {
    const annotation = annotations.get(offset);
    if (annotation) {
      const width = annotation.characters;
      parts.push(
        <span key={offset} className="annotated-character editor-han">
          {char}
          <span
            aria-hidden="true"
            className="editor-reading"
            style={{ width: width * 1.6 + "em" }}
          >
            <i
              data-reading={annotation.reading}
              style={
                {
                  "--reading-scale": annotation.scale,
                  "--mobile-reading-scale": annotation.mobileScale,
                } as CSSProperties
              }
            />
          </span>
        </span>,
      );
    } else if (hasHanzi(char)) {
      parts.push(
        <span key={offset} className="editor-han">
          {char}
        </span>,
      );
    } else parts.push(char);
    offset += char.length;
  }
  return parts;
}
function decoratedText(
  text: string,
  words: Word[] | undefined,
  target: { position: number; term: string } | undefined,
  hasIssue: boolean,
  showPinyin: boolean,
  defaultReadings?: Record<string, string>,
) {
  if (!words && !hasIssue && !target && !showPinyin) return text;
  const spans = words ? wordSpans(text, words) : [];
  const breaks = new Set([0, text.length]);
  for (const span of spans) {
    breaks.add(span.start);
    breaks.add(span.end);
  }
  if (target?.term) {
    breaks.add(target.position);
    breaks.add(target.position + target.term.length);
  }
  let overflow = text.length;
  if (hasIssue) {
    overflow = [...lyricElements(text)][11]?.index ?? text.length;
    breaks.add(overflow);
  }
  const annotations = new Map<number, Annotation>();
  if (showPinyin) {
    for (const { start, end, word } of spans) {
      const reading = word.pinyin || defaultReadings?.[word.hanzi];
      if (!reading || !hasHanzi(word.hanzi)) continue;
      const syllables = alignedReadings({ ...word, pinyin: reading });
      if (/\s/u.test(reading.trim())) {
        let offset = start;
        for (const part of readingParts({ ...word, pinyin: reading })) {
          annotations.set(offset, {
            end: offset + part.hanzi.length,
            characters: [...part.hanzi].length,
            reading: part.pinyin,
          });
          offset += part.hanzi.length;
        }
      } else if (!syllables)
        annotations.set(start, {
          end,
          characters: [...word.hanzi].length,
          reading,
        });
      else {
        let at = start;
        for (const [i, character] of [...word.hanzi].entries()) {
          annotations.set(at, {
            end: at + character.length,
            characters: 1,
            reading: syllables[i],
          });
          at += character.length;
        }
      }
    }
  }
  fitReadings(text, annotations);
  const cuts = [...breaks].sort((a, b) => a - b);
  return cuts.slice(0, -1).map((start, i) => {
    const segment = spans.findIndex((s) => s.start <= start && start < s.end);
    const inspected =
      target &&
      start >= target.position &&
      start < target.position + target.term.length;
    const Tag = start >= overflow ? "mark" : "span";
    return (
      <Tag
        key={start}
        data-segment={segment < 0 ? undefined : segment % 2}
        data-inspected={inspected || undefined}
      >
        {annotateSlice(text.slice(start, cuts[i + 1]), start, annotations)}
      </Tag>
    );
  });
}
function proposalDiff(lines: Line[], patch: Patch) {
  const at = patchIndex(lines, patch);
  const diff: { text: string; marker: " " | "+" | "−" }[] = [];
  const preceding = at >= 0 ? lines[at - 1]?.text : undefined;
  const following = at >= 0 ? lines[at + patch.before.length]?.text : undefined;
  if (preceding !== undefined) diff.push({ text: preceding, marker: " " });
  if (patch.label === "Section heading") {
    // Section patches keep the exact ordered lyric lines. Align those lines
    // while treating inserted and removed section markup as edits.
    let before = 0,
      after = 0;
    while (before < patch.before.length || after < patch.after.length) {
      const oldLine = patch.before[before],
        newLine = patch.after[after];
      if (oldLine === newLine) {
        diff.push({ text: oldLine, marker: " " });
        before++;
        after++;
      } else if (
        oldLine !== undefined &&
        (oldLine.trim().startsWith("[") || newLine === undefined)
      ) {
        diff.push({ text: oldLine, marker: "−" });
        before++;
      } else {
        diff.push({ text: newLine, marker: "+" });
        after++;
      }
    }
  } else {
    diff.push(
      ...patch.before.map((text) => ({ text, marker: "−" as const })),
      ...patch.after.map((text) => ({ text, marker: "+" as const })),
    );
  }
  if (following !== undefined) diff.push({ text: following, marker: " " });
  return diff.map(({ text, marker }, index) => {
    const adjacent = (other: (typeof diff)[number] | undefined) =>
      other && other.marker !== " ";
    if (
      marker === " " &&
      !adjacent(diff[index - 1]) &&
      !adjacent(diff[index + 1])
    ) {
      return index > 0 && adjacent(diff[index - 2]) ? (
        <span key={index}>{"  …\n"}</span>
      ) : null;
    }
    return (
      <span key={index} data-change={marker}>
        {marker} {text}
        {"\n"}
      </span>
    );
  });
}

export function LyricsEditor({
  lines,
  change,
  proposals = [],
  dismiss,
  editor,
  history,
  initialLine = 0,
  readOnly = false,
  existing = false,
  onWordReview,
  inspectCursor,
  wordChoices,
  inspected,
  revealOccurrence,
  proposalBatch,
  active = true,
  beforeEditor,
  editorAction,
  afterEditor,
  dictionary,
  onDictionaryToggle,
}: {
  proposalBatch?: number;
  active?: boolean;
  beforeEditor?: ReactNode;
  editorAction?: ReactNode;
  onDictionaryToggle?: (open: boolean) => void;
  dictionary?: ReactNode;
  afterEditor?: ReactNode;
  revealOccurrence?: { id: string };
  onWordReview?: (target: {
    id: string;
    offset: number;
    length: number;
  }) => void;
  wordChoices?: Map<string, Word[]>;
  inspected?: {
    id: string;
    text: string;
    words: Word[];
    offset: number;
    length: number;
  };
  inspectCursor?: boolean;
  lines: Line[];
  change: (lines: Line[]) => void;
  proposals?: Patch[];
  dismiss?: (patch: Patch) => void;
  editor: RefObject<LyricField | null>;
  history?: (redo: boolean) => void;
  initialLine?: number;
  readOnly?: boolean;
  existing?: boolean;
}) {
  const instanceId = useId();
  const editorId = readOnly ? instanceId : "lyrics-document";
  const summaryId = readOnly ? editorId + "-summary" : "document-summary";
  const problemId = readOnly ? editorId + "-problem" : "document-problem";
  const { rows, groups, issues } = parseLines(lines);
  const [issueId, setIssue] = useState<string>(),
    [split, setSplit] = useState(false),
    [suggestion, setSuggestion] = useState<Patch>();
  const [textScale, setTextScale] = useState(1);
  const [showPinyin, setShowPinyin] = useState(true);
  const pinyinLayout = showPinyin && rows.some((row) => hasHanzi(row.text));
  const rowHeight = (pinyinLayout ? 34 : 26) * textScale;
  const previousHeight = useRef(rowHeight);
  useLayoutEffect(() => {
    const field = editor.current;
    if (field && previousHeight.current !== rowHeight) {
      field.scrollTop = (field.scrollTop * rowHeight) / previousHeight.current;
    }
    previousHeight.current = rowHeight;
  }, [rowHeight, editor]);
  const [selected, setSelected] = useState(initialLine);

  const lyricTexts =
    wordChoices && active && !existing
      ? rows.filter((row) => hasHanzi(row.text)).map((row) => row.text)
      : [];
  const dictionaryWords = useVisibleWords(lyricTexts);
  const target =
    inspected &&
    inspectedWord(
      inspected.text,
      inspected.words,
      inspected.offset,
      inspected.length,
    );
  const [expanded, setExpanded] = useState(new Set<string>());
  const [rail, setRail] = useState<"structure" | "suggestions">("structure");
  const layer = useRef<HTMLDivElement>(null),
    gutter = useRef<HTMLDivElement>(null);
  const issue = issues.find((i) => lines[i.line].id === issueId) ?? issues[0];
  const [highlighted, setHighlighted] = useState<string>();
  const shownBatch = useRef<number | undefined>(undefined);

  const pendingReveal = useRef<number | undefined>(undefined);
  const reviewing = proposals.length > 0 && rail === "suggestions";
  const patch =
    suggestion && proposals.includes(suggestion)
      ? suggestion
      : (proposals.find((proposal) => patchIndex(lines, proposal) >= 0) ??
        proposals[0]);
  const value = lines.map((l) => l.text).join("\n");
  const composing = useRef(false);
  const pendingSelection = useRef<
    | (ReturnType<typeof fieldSelection> & { top: number; left: number })
    | undefined
  >(undefined);
  const selections = useRef(
    new WeakMap<Line[], ReturnType<typeof fieldSelection> & { top: number }>(),
  );
  const currentHistory = useRef(history);
  currentHistory.current = history;
  useLayoutEffect(() => {
    const field = editor.current;
    if (!field || composing.current) return;
    const pending = pendingSelection.current;
    const saved = pending ?? selections.current.get(lines);
    pendingSelection.current = undefined;
    if (field instanceof HTMLDivElement) paintLyricField(field, value);
    if (saved) {
      if (pending) field.focus({ preventScroll: true });
      if (
        field instanceof HTMLTextAreaElement ||
        document.activeElement === field
      )
        selectField(field, saved.start, saved.end, saved.backward);
      field.scrollTop = saved.top;
      if (pending) field.scrollLeft = pending.left;
    }
  }, [lines, editor, pinyinLayout, value]);
  // Native listeners and reveal requests use the latest editor state.
  const latestEditorActions = useRef({
    insertFieldText,
    inspect,
    reveal,
    lines,
  });
  latestEditorActions.current = { insertFieldText, inspect, reveal, lines };
  useEffect(() => {
    const field = editor.current;
    function beforeInput(e: Event) {
      if (!(e instanceof InputEvent)) return;
      if (
        field instanceof HTMLDivElement &&
        (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak")
      ) {
        e.preventDefault();
        latestEditorActions.current.insertFieldText(field, "\n");
      }
      if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {
        e.preventDefault();
        currentHistory.current?.(e.inputType === "historyRedo");
      }
    }
    field?.addEventListener("beforeinput", beforeInput);
    return () => field?.removeEventListener("beforeinput", beforeInput);
  }, [editor, pinyinLayout]);
  function inspect(field: LyricField, documentLines = lines) {
    const selection = fieldSelection(field);
    const prefix = fieldText(field).slice(0, selection.start);
    const row = documentLines[prefix.split("\n").length - 1];
    if (!row) return;
    const offset = prefix.length - prefix.lastIndexOf("\n") - 1;
    onWordReview?.({
      id: row.id,
      offset,
      length: Math.min(
        selection.end - selection.start,
        row.text.length - offset,
      ),
    });
  }
  useEffect(() => {
    if (!inspectCursor) return;
    const field = editor.current;
    const selectionChanged = () => {
      if (field && document.activeElement === field && !composing.current) {
        const selection = fieldSelection(field);
        selections.current.set(lines, { ...selection, top: field.scrollTop });
        setSelected(
          fieldText(field).slice(0, selection.start).split("\n").length - 1,
        );
        latestEditorActions.current.inspect(field);
      }
    };
    document.addEventListener("selectionchange", selectionChanged);
    field?.addEventListener("select", selectionChanged);
    return () => {
      document.removeEventListener("selectionchange", selectionChanged);
      field?.removeEventListener("select", selectionChanged);
    };
  }, [inspectCursor, editor, lines, pinyinLayout]);
  function attachField(field: LyricField | null) {
    editor.current = field;
    if (field && !field.dataset.ready) {
      field.dataset.ready = "true";
      if (active && (initialLine || readOnly))
        requestAnimationFrame(() => reveal(initialLine));
    }
  }
  function syncScroll(field: LyricField) {
    if (layer.current) {
      layer.current.scrollTop = field.scrollTop;
      layer.current.scrollLeft = field.scrollLeft;
    }
    if (gutter.current) gutter.current.scrollTop = field.scrollTop;
  }
  function updateField(
    field: LyricField,
    text = fieldText(field),
    offset = fieldSelection(field).start,
  ) {
    setHighlighted(undefined);
    const next = editLines(lines, text, offset);
    if (field instanceof HTMLDivElement) {
      selections.current.set(next, {
        start: offset,
        end: offset,
        backward: false,
        top: field.scrollTop,
      });
      if (text === value) {
        paintLyricField(field, value);
        selectField(field, offset, offset);
      }
    }
    change(next);
    if (inspectCursor && field instanceof HTMLTextAreaElement)
      inspect(field, next);
  }
  function insertFieldText(field: HTMLDivElement, insertion: string) {
    const { start, end } = fieldSelection(field);
    const text = fieldText(field);
    updateField(
      field,
      text.slice(0, start) + insertion + text.slice(end),
      start + insertion.length,
    );
  }
  function handleHistory(e: React.KeyboardEvent<LyricField>) {
    if (history && (e.metaKey || e.ctrlKey) && /^(z|y)$/iu.test(e.key)) {
      e.preventDefault();
      history(e.shiftKey || e.key.toLowerCase() === "y");
    }
  }
  function reveal(n: number) {
    if (n < 0) return;
    const field = editor.current;
    if (!field) return;
    const offset = lines
      .slice(0, n)
      .reduce((sum, l) => sum + l.text.length + 1, 0);
    const bounds = field.getBoundingClientRect();
    if (bounds.top >= window.innerHeight || bounds.bottom <= 0)
      field.scrollIntoView({ block: "nearest" });
    field.focus({ preventScroll: true });
    selectField(field, offset, offset);
    field.scrollTop = Math.max(0, n * rowHeight - field.clientHeight / 3);
    setSelected(n);
    if (inspectCursor) inspect(field);
  }
  useLayoutEffect(() => {
    if (pendingReveal.current === undefined) return;
    latestEditorActions.current.reveal(pendingReveal.current);
    pendingReveal.current = undefined;
  }, [lines]);
  useLayoutEffect(() => {
    if (!revealOccurrence) return;
    const { lines, reveal } = latestEditorActions.current;
    const index = lines.findIndex((line) => line.id === revealOccurrence.id);
    if (index >= 0) {
      reveal(index);
      setHighlighted(revealOccurrence.id);
    }
  }, [revealOccurrence]);
  useLayoutEffect(() => {
    if (!active || !proposals.length || shownBatch.current === proposalBatch)
      return;
    shownBatch.current = proposalBatch;
    setRail("suggestions");
    const actionable = proposals.find(
      (proposal) => patchIndex(lines, proposal) >= 0,
    );
    setSuggestion(actionable);
    if (actionable)
      latestEditorActions.current.reveal(patchIndex(lines, actionable));
  }, [active, lines, proposalBatch, proposals]);
  function showIssue(i: number) {
    const target = issues[i];
    if (!target) return;
    setIssue(lines[target.line].id);
    setSplit(false);
    reveal(target.line);
  }
  function acceptPatch(patch: Patch) {
    const at = patchIndex(lines, patch);
    if (at < 0) return;
    const updated = applyPatch(lines, patch);
    const index = proposals.indexOf(patch);
    const next = [
      ...proposals.slice(index + 1),
      ...proposals.slice(0, index),
    ].find((candidate) => patchIndex(updated, candidate) >= 0);
    pendingReveal.current = next ? patchIndex(updated, next) : at;
    setSuggestion(next);
    change(updated);
    dismiss?.(patch);
  }
  function showPatch(p: Patch) {
    setSuggestion(p);
    setRail("suggestions");
    reveal(patchIndex(lines, p));
  }
  const rowAt = new Map(rows.map((r) => [r.line, r])),
    groupAt = new Map(groups.map((g) => [g.line, g]));
  const issueAt = new Map(
    issues.map((issue, i) => [issue.line, { ...issue, index: i }]),
  );
  const proposalAt = new Map(proposals.map((p) => [p.ids[0], p]));
  const buckets: {
    name: string;
    line: number;
    items: typeof rows;
    issues: number;
  }[] = [];
  for (const idx of lines.keys()) {
    const group = groupAt.get(idx),
      row = rowAt.get(idx);
    if (group)
      buckets.push({ name: group.name, line: idx, items: [], issues: 0 });
    if (row) {
      if (
        !row.section &&
        (!buckets.length ||
          buckets.at(-1)!.items.at(-1)?.section !== undefined ||
          groupAt.has(buckets.at(-1)!.line))
      )
        buckets.push({ name: "Ungrouped", line: idx, items: [], issues: 0 });
      buckets.at(-1)?.items.push(row);
    }
    if (issueAt.has(idx) && buckets.length) buckets.at(-1)!.issues++;
  }
  const move = (index: number, length: number, delta: number) =>
    index < 0
      ? delta > 0
        ? 0
        : length - 1
      : (index + length + delta) % length;
  const suggested = issue?.count ? suggestPieces(lines[issue.line].text) : [];
  const pieces =
    issue && validPieces(lines[issue.line].text, suggested) ? suggested : [];
  const EditorPane = beforeEditor || afterEditor ? "section" : "div";
  return (
    <>
      <div className="document-layout">
        <EditorPane className="editor-pane">
          {beforeEditor}
          <div className="editor-caption">
            <label
              id={editorId + "-label"}
              htmlFor={editorId}
              onClick={() => {
                if (pinyinLayout) editor.current?.focus();
              }}
            >
              {readOnly ? "Insertion preview" : "Lyrics editor"}
            </label>
            {editorAction}
            {!readOnly && (
              <span>
                Start a section with [Verse] or [Chorus]. End it with a blank
                line or [/].
              </span>
            )}
            <label className="editor-text-size">
              Text size
              <select
                value={textScale}
                onChange={(event) => setTextScale(Number(event.target.value))}
              >
                {[1, 1.25, 1.5, 2].map((scale) => (
                  <option key={scale} value={scale}>
                    {scale * 100}%
                  </option>
                ))}
              </select>
            </label>
            <label className="editor-pinyin-toggle">
              <input
                type="checkbox"
                checked={showPinyin}
                onChange={(e) => {
                  const field = editor.current;
                  if (field)
                    pendingSelection.current = {
                      ...fieldSelection(field),
                      top: field.scrollTop,
                      left: field.scrollLeft,
                    };
                  setShowPinyin(e.target.checked);
                }}
              />{" "}
              Show Pinyin
            </label>
          </div>
          <div
            className="editor-surface"
            style={
              {
                "--editor-scale": textScale,
                "--editor-row-height": rowHeight + "px",
              } as CSSProperties
            }
            data-pinyin={pinyinLayout || undefined}
          >
            <div className="editor-gutter" ref={gutter}>
              <div>
                {lines.map((l, i) => {
                  const err = issueAt.get(i)?.index ?? -1,
                    proposal = proposalAt.get(l.id);
                  return err >= 0 || proposal ? (
                    <button
                      key={l.id}
                      data-current-line={i === selected || undefined}
                      aria-label={
                        "Line " +
                        (i + 1) +
                        (err >= 0 ? " problem" : " suggestion")
                      }
                      onClick={() =>
                        err >= 0 ? showIssue(err) : showPatch(proposal!)
                      }
                    >
                      {i + 1} {err >= 0 ? "!" : "+"}
                    </button>
                  ) : (
                    <span
                      key={l.id}
                      data-current-line={i === selected || undefined}
                    >
                      {i + 1}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="editor-body">
              <div className="editor-decoration" ref={layer}>
                {lines.map((l, i) => (
                  <div
                    key={l.id}
                    data-current-line={i === selected || undefined}
                    data-inserted-highlight={l.id === highlighted || undefined}
                    className={
                      issueAt.has(i)
                        ? "editor-line-issue"
                        : reviewing && patch?.ids[0] === l.id
                          ? "editor-line-proposed"
                          : l.text.trim().startsWith("[")
                            ? "heading-text"
                            : undefined
                    }
                  >
                    <span aria-hidden="true">
                      {decoratedText(
                        l.text,
                        inspected?.id === l.id && inspected.text === l.text
                          ? inspected.words
                          : (wordChoices?.get(l.text) ??
                              dictionaryWords.get(l.text)?.words),
                        inspected?.id === l.id && inspected.text === l.text
                          ? target
                          : undefined,
                        !!issueAt.get(i)?.count,
                        showPinyin && rowAt.has(i) && hasHanzi(l.text),
                        dictionaryWords.get(l.text)?.readings,
                      )}
                      {issueAt.get(i)?.count && (
                        <small> {issueAt.get(i)?.count} / 11</small>
                      )}
                    </span>
                    {proposalAt.has(l.id) && (
                      <button
                        type="button"
                        className="proposal-hint"
                        disabled={patchIndex(lines, proposalAt.get(l.id)!) < 0}
                        aria-label={`Apply suggestion on line ${i + 1}`}
                        onClick={() => acceptPatch(proposalAt.get(l.id)!)}
                      >
                        {"\u3000↳ "}
                        {proposalAt.get(l.id)!.label === "Section heading"
                          ? proposalAt.get(l.id)!.after[0]
                          : "Line-break suggestion"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {pinyinLayout ? (
                <div
                  id={editorId}
                  ref={attachField}
                  role="textbox"
                  aria-multiline="true"
                  aria-labelledby={editorId + "-label"}
                  aria-readonly={readOnly || undefined}
                  aria-invalid={issues.length > 0 || undefined}
                  aria-describedby={
                    issue ? summaryId + " " + problemId : summaryId
                  }
                  className="raw document-input"
                  contentEditable={readOnly ? false : "plaintext-only"}
                  tabIndex={readOnly ? 0 : undefined}
                  spellCheck={false}
                  onScroll={(e) => syncScroll(e.currentTarget)}
                  onCompositionStart={() => {
                    composing.current = true;
                  }}
                  onCompositionEnd={(e) => {
                    composing.current = false;
                    updateField(e.currentTarget);
                  }}
                  onInput={(e) => {
                    if (!composing.current) updateField(e.currentTarget);
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    if (readOnly) return;
                    insertFieldText(
                      e.currentTarget,
                      e.clipboardData
                        .getData("text/plain")
                        .replace(/\r\n?/gu, "\n"),
                    );
                  }}
                  onKeyDown={(e) => {
                    if (
                      !readOnly &&
                      !e.nativeEvent.isComposing &&
                      e.key === "Enter"
                    ) {
                      e.preventDefault();
                      insertFieldText(e.currentTarget, "\n");
                    } else handleHistory(e);
                  }}
                />
              ) : (
                <textarea
                  id={editorId}
                  ref={attachField}
                  aria-invalid={issues.length > 0 || undefined}
                  aria-describedby={
                    issue ? summaryId + " " + problemId : summaryId
                  }
                  className="raw document-input"
                  placeholder={"[Verse]\nOne lyric per line"}
                  readOnly={readOnly}
                  wrap="off"
                  spellCheck={false}
                  value={value}
                  onScroll={(e) => syncScroll(e.currentTarget)}
                  onSelect={(e) => {
                    const el = e.currentTarget;
                    selections.current.set(lines, {
                      ...fieldSelection(el),
                      top: el.scrollTop,
                    });
                    if (inspectCursor) inspect(el);
                    setSelected(
                      value.slice(0, el.selectionStart).split("\n").length - 1,
                    );
                  }}
                  onChange={(e) => updateField(e.currentTarget)}
                  onKeyDown={handleHistory}
                />
              )}
            </div>
          </div>
          <div className="document-summary" id={summaryId} aria-live="polite">
            <span>
              {issues.length} {issues.length === 1 ? "issue" : "issues"}
            </span>
            {issues.length > 0 &&
              [-1, 1].map((d) => (
                <button
                  key={d}
                  aria-label={d < 0 ? "Previous issue" : "Next issue"}
                  onClick={() =>
                    showIssue(
                      move(
                        issueId ? issues.indexOf(issue!) : -1,
                        issues.length,
                        d,
                      ),
                    )
                  }
                >
                  {d < 0 ? "↑" : "↓"}
                </button>
              ))}
            <span>{proposals.length} suggestions</span>
          </div>
          {issue && (
            <section className="document-patch document-diagnostic">
              <strong id={problemId}>
                Line {issue.line + 1} ·{" "}
                {readOnly && issue.count
                  ? issue.count + " / 11 · Review splits to add this passage."
                  : issue.message}
              </strong>
              {!readOnly && (
                <button onClick={() => reveal(issue.line)}>Fix manually</button>
              )}
              {!readOnly && !existing && pieces.length > 1 && !split && (
                <button onClick={() => setSplit(true)}>
                  Show suggested split
                </button>
              )}
              {split && (
                <>
                  <pre>
                    {pieces
                      .map((p) => p + "  ·  " + lyricCount(p) + " / 11")
                      .join("\n")}
                  </pre>
                  <button
                    onClick={() => {
                      change(
                        applyPatch(lines, {
                          label: "Split",
                          ids: [lines[issue.line].id],
                          before: [lines[issue.line].text],
                          after: pieces,
                        }),
                      );
                      reveal(issue.line);
                    }}
                  >
                    Accept split
                  </button>
                  <button
                    onClick={() => {
                      setSplit(false);
                      reveal(issue.line);
                    }}
                  >
                    Dismiss
                  </button>
                </>
              )}
            </section>
          )}
          {afterEditor}
        </EditorPane>
        <aside className="structure-preview" data-reviewing={reviewing}>
          {dictionary && (
            <details
              className="word-inspector"
              onToggle={(e) => {
                onDictionaryToggle?.(e.currentTarget.open);
                if (e.currentTarget.open && editor.current)
                  inspect(editor.current);
              }}
            >
              <summary>
                <h3>Dictionary</h3>
              </summary>
              {dictionary}
            </details>
          )}
          <h3>{reviewing ? "Review suggestions" : "Structure preview"}</h3>
          {proposals.length > 0 && (
            <div className="review-tabs" role="group" aria-label="Review rail">
              <button
                aria-pressed={reviewing}
                onClick={() => showPatch(patch!)}
              >
                Suggestions ({proposals.length})
              </button>
              <button
                aria-pressed={!reviewing}
                onClick={() => setRail("structure")}
              >
                Structure ({groups.length})
              </button>
            </div>
          )}
          {reviewing && patch && (
            <section className="document-patch">
              <small>
                Suggestion {proposals.indexOf(patch) + 1} of {proposals.length}
                {patchIndex(lines, patch) >= 0 &&
                  " · Line " + (patchIndex(lines, patch) + 1)}
              </small>
              <strong>{patch.label}</strong>
              <pre className="proposal-diff">{proposalDiff(lines, patch)}</pre>
              <div className="proposal-actions">
                {proposals.length > 0 &&
                  [-1, 1].map((d) => (
                    <button
                      key={d}
                      aria-label={
                        d < 0 ? "Previous suggestion" : "Next suggestion"
                      }
                      onClick={() =>
                        showPatch(
                          proposals[
                            move(
                              reviewing ? proposals.indexOf(patch!) : -1,
                              proposals.length,
                              d,
                            )
                          ],
                        )
                      }
                    >
                      {d < 0 ? "Previous" : "Next"}
                    </button>
                  ))}
                {patchIndex(lines, patch) < 0 ? (
                  <p>Outdated. Run Review with AI again.</p>
                ) : (
                  <button onClick={() => acceptPatch(patch)}>
                    Accept suggestion
                  </button>
                )}
                <button
                  onClick={() => {
                    dismiss?.(patch);
                    editor.current?.focus();
                  }}
                >
                  Dismiss suggestion
                </button>
              </div>
            </section>
          )}
          {!reviewing && (
            <>
              <p>
                {rows.length} occurrences · {groups.length} sections ·{" "}
                {issues.length} issues
              </p>
              <div className="preview-sections">
                {buckets.map((b) => (
                  <details
                    key={lines[b.line].id}
                    onToggle={(e) => {
                      const open = e.currentTarget.open,
                        id = lines[b.line].id;
                      setExpanded((prev) => {
                        if (prev.has(id) === open) return prev;
                        const next = new Set(prev);
                        if (open) next.add(id);
                        else next.delete(id);
                        return next;
                      });
                    }}
                  >
                    <summary>
                      {b.name}{" "}
                      <small>
                        {b.items.length}{" "}
                        {b.items.length === 1 ? "line" : "lines"}
                        {b.issues ? " · " + b.issues + " issues" : ""}
                      </small>
                    </summary>
                    {expanded.has(lines[b.line].id) && (
                      <ul className="outline-lyrics">
                        {b.items.map((row) => (
                          <li key={row.id}>
                            <a
                              href="#lyrics-document"
                              aria-current={
                                selected === row.line ? "location" : undefined
                              }
                              onClick={(event) => {
                                event.preventDefault();
                                const issue = issueAt.get(row.line);
                                if (issue) showIssue(issue.index);
                                else reveal(row.line);
                              }}
                            >
                              {row.line + 1}
                              {"\u3000"}
                              {row.text}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                ))}
              </div>
              {!groups.length && rows.length > 0 && (
                <p className="preview-help">
                  Add a section heading on its own line to group lyrics. Expand
                  a section to jump to its lines.
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
