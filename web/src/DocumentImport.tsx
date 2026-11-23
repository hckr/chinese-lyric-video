import type { LyricField } from "./lyric-field.ts";
import { probeTracks } from "./waveform-stream.ts";
import type { VerifiedSplitAudio } from "./AutomaticTiming";
import { ImportAudioSplits } from "./ImportAudioSplits";
import { needsImportSplit } from "./automatic-timing";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  PassagePinyin,
  useWordReview,
  WordReview,
  type WordProvider,
} from "./WordReview";
import { useEditorHistory, type EditorHistory } from "./useEditorHistory";
import { headerFields, lyricHeaders } from "./lyric-headers";
import { formatTime } from "./timing";
import { LyricsEditor } from "./LyricsEditor";
import { ImportSuggestions } from "./ImportSuggestions";
import { ImportComparison, comparisonFindings } from "./ImportComparison";
import {
  linesFrom,
  parseLines,
  type Line,
  type Patch,
} from "./lyrics-document";
import {
  newId,
  projectSchema,
  type Project,
  type Occurrence,
  type Word,
} from "./domain";

type Draft = {
  lastInsertion?: { id: string; text: string };
  choices: Map<string, Word[]>;
  lines: Line[];
  comparison?: Project;
  evidence: Map<string, Occurrence>;
};
async function prepare(
  lines: Line[],
  title: string,
  artist: string,
  analysis = false,
) {
  const { rows, groups, issues } = parseLines(lines);
  if (!rows.length || (!analysis && issues.length))
    throw Error("Resolve the document problems before importing.");
  const response = await fetch("/api/import-lyrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      artist,
      document: {
        occurrences: rows.map(({ id, text }) => ({ id, text })),
        groups: groups
          .filter((g) => g.occurrenceIds.length)
          .map(({ line, ...g }) => g),
      },
      review: analysis,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Could not prepare the lyrics.");
  return projectSchema.parse(analysis ? data.project : data);
}
export function DocumentImport({
  source,
  publishHistory,
  editor,
  active,
  locked,
  runImport,
  reportAI,
  reportAudio,
}: {
  publishHistory: (h: EditorHistory | null) => void;
  source: { text: string };
  editor: RefObject<LyricField | null>;
  active: boolean;
  locked: boolean;
  runImport: (load: () => Promise<Project>, audio: File | null) => void;
  reportAI: (s: string) => void;
  reportAudio: (s: string) => void;
}) {
  const [splitAudio, setSplitAudio] = useState<VerifiedSplitAudio>();
  const [draft, setDraft] = useState<Draft>(() => ({
    choices: new Map(),
    lines: linesFrom(source.text),
    evidence: new Map(),
  }));
  const past = useRef<{ draft: Draft; restoreComparison: boolean }[]>([]),
    future = useRef<typeof past.current>([]);
  const [title, setTitle] = useState(""),
    [artist, setArtist] = useState(""),
    [file, setFile] = useState<File | null>(null);
  const [mediaDuration, setMediaDuration] = useState<number>();
  useEffect(() => {
    setMediaDuration(undefined);
    if (!file) return;
    const media = document.createElement("audio");
    const url = URL.createObjectURL(file);
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      if (Number.isFinite(media.duration))
        setMediaDuration(Math.round(media.duration * 1000));
    };
    media.src = url;
    return () => {
      media.onloadedmetadata = null;
      media.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [file]);
  const [view, setView] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [patches, setPatches] = useState<Patch[]>([]);
  const [proposalBatch, setProposalBatch] = useState(0);
  const [revealOccurrence, setRevealOccurrence] = useState<{ id: string }>();
  const insertionReceipt =
    draft.lastInsertion &&
    draft.lines.some((line) => line.id === draft.lastInsertion?.id)
      ? draft.lastInsertion
      : undefined;
  const receiptRef = useRef<HTMLButtonElement>(null);

  const [insertion, setInsertion] = useState<{
    project: Project;
    added: Occurrence[];
    at: number;
    placement?: string;
    heading: string;
  }>();
  const request = useRef(0),
    fileInput = useRef<HTMLInputElement>(null);
  const compareTrigger = useRef<HTMLButtonElement>(null);
  const { lines, comparison } = draft,
    parsed = parseLines(lines);
  const [wordTarget, setWordTarget] = useState<{
      id: string;
      offset: number;
      length: number;
    }>(),
    [provider, setProvider] = useState<WordProvider>();
  const inspectWord = useCallback(
    (target: { id: string; offset: number; length: number }) => {
      setWordTarget((previous) =>
        previous?.id === target.id &&
        previous.offset === target.offset &&
        previous.length === target.length
          ? previous
          : target,
      );
    },
    [],
  );
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [comparisonStatus, setComparisonStatus] = useState("");
  const relayAudio = useCallback(
    (status: string) => {
      setComparisonStatus(status);
      reportAudio(status);
    },
    [reportAudio],
  );
  const pendingSplits =
    comparison?.timingRun?.candidates.some(needsImportSplit);
  useEffect(() => {
    if (pendingSplits) reportAudio("!");
  }, [pendingSplits, reportAudio]);
  const findings = comparison?.timingRun
    ? comparisonFindings(comparison)
    : undefined;
  const metadata = { title, artist };
  const headerSuggestions = lyricHeaders(lines).filter(
    ({ field, value }) => metadata[field] !== value,
  );
  const wordLine = parsed.rows.find((row) => row.id === wordTarget?.id),
    word = useWordReview(wordLine),
    phrase = word.review?.project.phrases[0];
  const signature = JSON.stringify(parsed.rows.map((r) => [r.id, r.text]));
  const live = useRef(signature);
  live.current = signature;
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  function commit(next: Draft, restoreComparison = false) {
    past.current.push({ draft, restoreComparison });
    if (past.current.length > 200) past.current.shift();
    future.current = [];
    setDraft(next);
    setInsertion(undefined);
    setError("");
  }
  function history(redo: boolean) {
    const stack = redo ? future : past,
      other = redo ? past : future,
      entry = stack.current.pop();
    if (entry) {
      const { draft: next, restoreComparison } = entry;
      other.current.push({ draft, restoreComparison });
      const sameLyrics =
        !restoreComparison &&
        signature ===
          JSON.stringify(
            parseLines(next.lines).rows.map((r) => [r.id, r.text]),
          );
      setDraft(
        sameLyrics ? { ...next, comparison, evidence: draft.evidence } : next,
      );
      setInsertion(undefined);
      if (!(sameLyrics ? comparison : next.comparison)) setView(false);
    }
  }
  useEditorHistory(
    active && !locked,
    past.current.length > 0,
    future.current.length > 0,
    history,
    publishHistory,
  );
  const lastAlignment = useRef<Project | undefined>(undefined);
  useEffect(() => {
    if (comparison?.timingRun) lastAlignment.current = comparison;
  }, [comparison]);
  function change(next: Line[], restoreAnalysis = true) {
    const same =
      signature ===
      JSON.stringify(parseLines(next).rows.map((r) => [r.id, r.text]));
    let retained = same ? comparison : undefined;
    const cached = restoreAnalysis && lastAlignment.current;
    if (!retained && cached) {
      // Typing a heading can temporarily turn its neighboring lyric into malformed markup.
      // Restore a completed alignment only for the complete identical occurrence sequence.
      const rows = parseLines(next).rows,
        known = new Set(cached.occurrences.map((o) => o.id));
      const texts = new Map(cached.phrases.map((p) => [p.id, p.lyricKey]));
      if (
        rows.length === cached.occurrences.length &&
        rows.filter((r) => !known.has(r.id)).length <= 1 &&
        rows.every((r, i) => {
          const o = cached.occurrences[i];
          return (
            texts.get(o.phraseId) === r.text &&
            (!known.has(r.id) || r.id === o.id)
          );
        })
      ) {
        const ids = new Map(
          rows.map((r, i) => [r.id, cached.occurrences[i].id]),
        );
        next = next.map((l) =>
          ids.has(l.id) ? { ...l, id: ids.get(l.id)! } : l,
        );
        retained = cached;
      }
    }
    commit({ ...draft, lines: next, comparison: retained });
    if (!retained) setView(false);
  }
  const opened = useRef(source);
  useEffect(() => {
    if (opened.current !== source) {
      opened.current = source;
      lastAlignment.current = undefined;
      change(linesFrom(source.text), false);
      setPatches([]);
    }
  }, [source]);
  function audioChanged(audio: File | null) {
    request.current++;
    lastAlignment.current = undefined;
    past.current = [];
    future.current = [];
    setFile(audio);
    setView(false);
    setInsertion(undefined);
    setBusy(false);
    relayAudio("");
    setDraft({
      ...draft,
      comparison: undefined,
      evidence: new Map(),
      lastInsertion: undefined,
    });
  }
  function withEvidence(p: Project) {
    return {
      ...p,
      phrases: p.phrases.map((phrase) =>
        draft.choices.has(phrase.lyricKey)
          ? { ...phrase, words: draft.choices.get(phrase.lyricKey)! }
          : phrase,
      ),
      occurrences: p.occurrences.map((o) => ({
        ...o,
        ...draft.evidence.get(o.id),
        phraseId: o.phraseId,
      })),
    };
  }
  async function compare() {
    if (comparison) {
      setView(true);
      return;
    }
    const serial = ++request.current;
    setBusy(true);
    reportAudio("Preparing…");
    setError("");
    try {
      const p = await prepare(lines, title, artist, true);
      if (serial === request.current && signature === live.current) {
        setDraft((prev) => ({ ...prev, comparison: withEvidence(p) }));
        setView(true);
      }
    } catch (e) {
      if (serial === request.current) setError(String(e));
    } finally {
      if (serial === request.current) {
        setBusy(false);
        reportAudio("");
      }
    }
  }
  function receive(p: Project) {
    const known = new Set(parsed.rows.map((r) => r.id)),
      added = p.occurrences.filter((o) => !known.has(o.id));
    if (added.length) {
      const next = p.occurrences
        .slice(p.occurrences.indexOf(added[0]) + 1)
        .find((o) => known.has(o.id));
      const at = next ? lines.findIndex((l) => l.id === next.id) : lines.length;
      setInsertion({ project: p, added, at, heading: "" });
      return;
    }
    setInsertion(undefined);
    if (
      p.timingRun?.candidates.some(needsImportSplit) &&
      !comparison?.timingRun?.candidates.some(needsImportSplit)
    )
      setView(false);
    setDraft((prev) => ({
      ...prev,
      comparison: p,
      evidence: new Map(p.occurrences.map((o) => [o.id, o])),
    }));
  }
  const firstInSection =
    insertion &&
    parsed.groups.find((g) => {
      const first = parsed.rows.find((r) => r.id === g.occurrenceIds[0]);
      return first && insertion.at > g.line && insertion.at <= first.line;
    });
  // An intro before a section's first lyric belongs before the heading.
  const insertionAt =
    insertion?.heading.trim() && firstInSection
      ? firstInSection.line
      : (insertion?.at ?? 0);
  function inserted() {
    if (!insertion) return [];
    const { heading, project, added } = insertion;
    const at = insertionAt;
    const items = added.map((o) => ({
      id: o.id,
      text: project.phrases.find((p) => p.id === o.phraseId)!.lyricKey,
    }));
    if (heading.trim()) {
      items.unshift({ id: newId(), text: "[" + heading.trim() + "]" });
      const following = parsed.rows.find((r) => r.line >= at);
      if (
        following &&
        !lines
          .slice(at, following.line)
          .some((l) => l.text.trim().startsWith("["))
      ) {
        const group = parsed.groups.find((g) => g.id === following.section);
        items.push({
          id: newId(),
          text: group ? "[" + group.name + "]" : "[/]",
        });
      }
    }
    return items;
  }
  const addedLines = inserted();
  const insertButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (insertion) insertButton.current?.focus();
  }, [insertion?.project]);
  return (
    <div className="document-import" data-audio-view={view}>
      <div hidden={view}>
        <LyricsEditor
          lines={lines}
          change={change}
          editor={editor}
          proposals={patches}
          proposalBatch={proposalBatch}
          active={active && !view}
          revealOccurrence={revealOccurrence}
          dismiss={(p) => setPatches(patches.filter((x) => x !== p))}
          history={history}
          onWordReview={inspectWord}
          wordChoices={draft.choices}
          inspected={
            dictionaryOpen &&
            wordTarget &&
            phrase?.lyricKey === wordLine?.text &&
            phrase
              ? {
                  ...wordTarget,
                  text: phrase.lyricKey,
                  words: draft.choices.get(phrase.lyricKey) ?? phrase.words,
                }
              : undefined
          }
          inspectCursor={dictionaryOpen}
          onDictionaryToggle={setDictionaryOpen}
          beforeEditor={
            <>
              <div className="document-metadata">
                {(["title", "artist"] as const).map((field) => {
                  const value = metadata[field],
                    setValue = field === "title" ? setTitle : setArtist;
                  const suggestion = headerSuggestions.find(
                    (s) => s.field === field,
                  )?.value;
                  return (
                    <label key={field}>
                      {field === "title" ? "Title" : "Artist"} (optional)
                      <span className="metadata-input">
                        <input
                          value={value}
                          placeholder={!value ? suggestion : undefined}
                          onChange={(e) => setValue(e.target.value)}
                        />
                        {suggestion && (
                          <button
                            type="button"
                            title={suggestion}
                            aria-label={`Apply ${headerFields[field]}: ${suggestion}`}
                            onClick={() => setValue(suggestion)}
                          >
                            {value ? "Replace" : "Apply"}
                          </button>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          }
          dictionary={
            <div>
              {word.error ? (
                <button onClick={word.retry}>{word.error} Retry</button>
              ) : phrase && phrase.lyricKey === wordLine?.text ? (
                <WordReview
                  key={wordLine.id}
                  text={phrase.lyricKey}
                  words={draft.choices.get(phrase.lyricKey) ?? phrase.words}
                  terms={word.review!.terms}
                  choose={(words) =>
                    commit({
                      ...draft,
                      choices: new Map(draft.choices).set(
                        phrase.lyricKey,
                        words.map((w) => ({ ...w, id: newId() })),
                      ),
                    })
                  }
                  provider={provider}
                  offset={wordTarget?.offset ?? 0}
                  length={wordTarget?.length ?? 0}
                />
              ) : (
                <p>
                  {wordLine
                    ? "Loading dictionary…"
                    : "Place the cursor on a lyric word."}
                </p>
              )}
            </div>
          }
          afterEditor={
            <>
              <div className="document-audio">
                <label htmlFor="document-audio-file">
                  Song media (audio or video, optional)
                </label>
                <input
                  id="document-audio-file"
                  hidden={!!file}
                  ref={fileInput}
                  type="file"
                  accept="audio/*,video/mp4,video/webm,.wav,.mp3,.m4a,.mp4,.ogg,.flac"
                  onChange={(e) => audioChanged(e.target.files?.[0] ?? null)}
                />
                {file && (
                  <div className="document-audio-file">
                    <span aria-hidden="true" className="audio-file-icon">
                      ♫
                    </span>
                    <span title={file.name}>{file.name}</span>
                    <small>
                      {mediaDuration !== undefined &&
                        formatTime(mediaDuration).split(".")[0] + " · "}
                      {new Intl.NumberFormat(undefined, {
                        maximumFractionDigits: 1,
                      }).format(file.size / 1000000)}{" "}
                      MB
                    </small>
                    <button
                      aria-label="Remove audio"
                      onClick={() => {
                        audioChanged(null);
                        if (fileInput.current) fileInput.current.value = "";
                        requestAnimationFrame(() => fileInput.current?.focus());
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
                {file && (
                  <div className="inline-audio-review">
                    <button
                      ref={compareTrigger}
                      disabled={busy || !parsed.rows.length}
                      onClick={compare}
                    >
                      {busy
                        ? "Preparing comparison…"
                        : findings || comparisonStatus
                          ? "Review alignment"
                          : "Compare with lyrics"}
                    </button>
                    <span role="status">
                      {comparisonStatus && comparisonStatus !== "!"
                        ? "Comparing lyrics · " + comparisonStatus
                        : findings
                          ? findings.matched.length +
                            " matched · " +
                            findings.discrepancies.length +
                            " to check · " +
                            comparison!.timingRun!.candidates.length +
                            " audio-only"
                          : comparisonStatus === "!"
                            ? "Comparison needs attention"
                            : ""}
                    </span>
                  </div>
                )}
              </div>
              <div className="document-actions">
                {!locked && (
                  <ImportSuggestions
                    onProvider={setProvider}
                    lines={lines}
                    proposals={patches}
                    setProposals={(next) => {
                      setPatches(next);
                      setProposalBatch((batch) => batch + 1);
                    }}
                    report={reportAI}
                  />
                )}
                <button
                  className="primary import-document-submit"
                  disabled={!parsed.rows.length || !!parsed.issues.length}
                  onClick={() =>
                    runImport(async () => {
                      const p = withEvidence(
                        await prepare(lines, title, artist),
                      );
                      const media =
                        file && mediaDuration && mediaDuration > 0
                          ? {
                              name: file.name,
                              size: file.size,
                              lastModified: file.lastModified,
                              durationMs: mediaDuration,
                              ...(await probeTracks(file).catch(() => ({}))),
                            }
                          : undefined;
                      return {
                        ...p,
                        ...(media ? { audio: media } : {}),
                        ...(comparison?.timingRun
                          ? {
                              timingRun: comparison.timingRun,
                              audio: media ?? comparison.audio,
                              timingSettings: comparison.timingSettings,
                            }
                          : {}),
                      };
                    }, file)
                  }
                >
                  Import document
                </button>
              </div>
            </>
          }
        />
        {!locked && comparison && pendingSplits && (
          <ImportAudioSplits
            project={comparison}
            file={file}
            verifiedAudio={splitAudio}
            active={active && !view}
            apply={(next) => {
              if (next.occurrences.length === comparison.occurrences.length)
                commit({ ...draft, comparison: next }, true);
              else {
                receive(next);
                setView(true);
              }
            }}
          />
        )}
      </div>
      {comparison && file && (
        <section className="comparison-card" hidden={!view}>
          <ImportComparison
            active={active && view}
            project={comparison}
            file={file}
            update={receive}
            onSplitAudioReady={setSplitAudio}
            report={relayAudio}
            onStart={() => {
              setView(false);
              if (active)
                requestAnimationFrame(() => compareTrigger.current?.focus());
            }}
            back={() => {
              setView(false);
              requestAnimationFrame(() => editor.current?.focus());
            }}
            passageId={insertion?.added[0].id}
            addedNotice={
              insertionReceipt &&
              !insertion && (
                <div className="comparison-status">
                  <span role="status">
                    <strong>Added to lyrics</strong> · {insertionReceipt.text}
                  </span>
                  <div className="actions">
                    <button
                      ref={receiptRef}
                      onClick={() => {
                        setRevealOccurrence({ id: insertionReceipt.id });
                        setView(false);
                      }}
                    >
                      View in editor
                    </button>
                    {past.current
                      .at(-1)
                      ?.draft.comparison?.timingRun?.candidates.some(
                        (candidate) => candidate.id === insertionReceipt.id,
                      ) && (
                      <button
                        onClick={() => {
                          history(false);
                          requestAnimationFrame(() =>
                            document
                              .querySelector<HTMLButtonElement>(
                                '[data-add-candidate="' +
                                  CSS.escape(insertionReceipt.id) +
                                  '"]',
                              )
                              ?.focus(),
                          );
                        }}
                      >
                        Undo insertion
                      </button>
                    )}
                  </div>
                </div>
              )
            }
            insertion={
              insertion && (
                <div className="insertion-controls">
                  <p>
                    {insertion.added
                      .map(
                        (o) =>
                          formatTime(o.startMs!) + "–" + formatTime(o.endMs!),
                      )
                      .join(" · ")}
                  </p>
                  <label>
                    Insert at
                    <select
                      value={
                        insertion.placement ??
                        (insertion.at === lines.length
                          ? "end"
                          : "before:" + insertion.at)
                      }
                      onChange={(e) => {
                        const placement = e.target.value;
                        setInsertion({
                          ...insertion,
                          placement,
                          at:
                            placement === "end"
                              ? lines.length
                              : Number(placement.split(":")[1]),
                        });
                      }}
                    >
                      {lines.map((line, i) => (
                        <option value={"before:" + i} key={line.id}>
                          Before line {i + 1} · {line.text}
                        </option>
                      ))}
                      {parsed.rows.map((row) => (
                        <option value={"after:" + (row.line + 1)} key={row.id}>
                          After line {row.line + 1} · {row.text}
                        </option>
                      ))}
                      <option value="end">End of document</option>
                    </select>
                  </label>
                  <label>
                    Section heading (optional)
                    <input
                      value={insertion.heading}
                      onChange={(e) =>
                        setInsertion({ ...insertion, heading: e.target.value })
                      }
                    />
                  </label>
                  <p className="insertion-preview-label">
                    Preview changes to lyrics
                  </p>
                  <pre className="insertion-diff">
                    {[
                      ...lines
                        .slice(Math.max(0, insertionAt - 2), insertionAt)
                        .map((l) => "  " + l.text),
                      ...addedLines.map((l) => "+ " + l.text),
                      ...lines
                        .slice(insertionAt, insertionAt + 2)
                        .map((l) => "  " + l.text),
                    ].join("\n")}
                  </pre>
                  {parsed.rows
                    .filter(
                      (row) =>
                        row.line >= insertionAt - 2 &&
                        row.line < insertionAt + 2,
                    )
                    .map((row) => (
                      <PassagePinyin key={row.id} id={row.id} text={row.text} />
                    ))}
                  <div className="insertion-actions">
                    <button
                      className="primary"
                      ref={insertButton}
                      disabled={
                        /[\[\]\r\n]/.test(insertion.heading) ||
                        insertion.heading.trim() === "/" ||
                        insertion.added.some((o) =>
                          /[\[\]\r\n]/.test(
                            insertion.project.phrases.find(
                              (p) => p.id === o.phraseId,
                            )!.lyricKey,
                          ),
                        )
                      }
                      onClick={() => {
                        const next = [
                          ...lines.slice(0, insertionAt),
                          ...addedLines,
                          ...lines.slice(insertionAt),
                        ];
                        const order = parseLines(next).rows,
                          records = new Map(
                            insertion.project.occurrences.map((o) => [o.id, o]),
                          );
                        commit({
                          ...draft,
                          lines: next,
                          comparison: {
                            ...insertion.project,
                            occurrences: order.map((r) => records.get(r.id)!),
                          },
                          evidence: records,
                          lastInsertion: {
                            id: insertion.added[0].id,
                            text: insertion.added
                              .map(
                                (occurrence) =>
                                  insertion.project.phrases.find(
                                    (phrase) =>
                                      phrase.id === occurrence.phraseId,
                                  )!.lyricKey,
                              )
                              .join(" / "),
                          },
                        });
                        requestAnimationFrame(() =>
                          receiptRef.current?.focus(),
                        );
                      }}
                    >
                      Confirm insertion
                    </button>
                    <button
                      onClick={() => {
                        const id = insertion.added[0].id;
                        setInsertion(undefined);
                        requestAnimationFrame(() =>
                          document
                            .querySelector<HTMLButtonElement>(
                              '[data-add-candidate="' + CSS.escape(id) + '"]',
                            )
                            ?.focus(),
                        );
                      }}
                    >
                      Cancel insertion
                    </button>
                  </div>
                </div>
              )
            }
          />
        </section>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
