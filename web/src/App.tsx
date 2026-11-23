import { AssetContext, useVideoFiles } from "./video-assets.tsx";
import { FootageSettings } from "./FootageSettings.tsx";
import { StudioHandoff } from "./StudioHandoff.tsx";
import { VideoDownload } from "./VideoDownload.tsx";
import type { VerifiedSplitAudio } from "./AutomaticTiming";
import { wordSpans } from "./word-spans";
import { ImportAudioSplits } from "./ImportAudioSplits";
import { needsImportSplit } from "./automatic-timing";
import type { EditorHistory } from "./useEditorHistory";
import { DocumentImport } from "./DocumentImport";
import {
  TranslateLyrics,
  type TranslationExchange,
} from "./TranslateLyrics.tsx";
import { translationState } from "./translation.ts";
import { version } from "../../package.json";
import { RepeatLyricDialog } from "./RepeatLyricDialog";
import { orderGroupedProject } from "./lyric-groups.ts";
import { DictionaryLookup } from "./DictionaryLookup";
import { RemoveAppearanceDialog } from "./RemoveAppearanceDialog";
import { draftDetectedWords, draftRawLyrics } from "./raw-import";
import { ProjectStructure } from "./ProjectStructure";
import { lyricCount, lyricLimit } from "./lyric-length";
import { TimingConfirmDialog } from "./TimingConfirmDialog";
import { TimingEditor } from "./TimingEditor";
import {
  attachAudioMetadata,
  withTimingBaseline,
  formatTime,
  timingStatus,
} from "./timing.ts";
import { WiktionaryDialog } from "./WiktionaryDialog";
import { useEffect, useRef, useState } from "react";
import {
  Project,
  Phrase,
  Word,
  History,
  Snapshot,
  commit,
  undo,
  redo,
  repeatAppearance,
  addLyric,
  removeAppearance,
  conflictingLyrics,
  parseProject,
  serializeProject,
  projectSchema,
  newId,
  pending,
  phraseIssues,
  phrasesInAppearanceOrder,
  hanzi,
  fixSpacing,
  joinReadings,
  mergeAdjacentTokens,
  splitToken,
  exportIssues,
} from "./domain";
import { splitSuggestions } from "./split-suggestions";
import { importLegacy, exportLegacy } from "./legacy";

const STORE = "lyric-workbench-v1";
function loadSession(): History | null {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const p = parseProject(raw);
    return initial(p);
  } catch {
    return null;
  }
}
function initial(project: Project): History {
  project = withTimingBaseline(project);
  return {
    present: {
      project,
      phraseId: project.phrases[0]?.id ?? "",
      tokenId: project.phrases[0]?.words[0]?.id ?? "",
      occurrenceId: project.occurrences[0]?.id,
    },
    past: [],
    future: [],
  };
}
function download(filename: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function GlossInput(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const resize = () => {
      el.style.height = "0px";
      const style = getComputedStyle(el);
      const line = parseFloat(style.lineHeight);
      const padding =
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + 2;
      el.style.height = `${Math.min(el.scrollHeight + 2, line * 3 + padding)}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [props.value]);
  return <textarea {...props} ref={ref} rows={1} className="gloss-input" />;
}
export function App() {
  const [history, setHistory] = useState<History | null>(loadSession),
    [screen, setScreen] = useState(history ? "Lyric editor" : "Import lyrics"),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [editorHistory, setEditorHistory] = useState<EditorHistory | null>(
    null,
  );
  const [documentSource, setDocumentSource] = useState({ text: "" });
  const [splitAudio, setSplitAudio] = useState<VerifiedSplitAudio>();
  const videoFiles = useVideoFiles();
  const [videoTab, setVideoTab] = useState<"Video" | "Thumbnail">("Video");
  const [projectAudio, setProjectAudio] = useState<File | null>(null);
  const [suggestionProgress, setSuggestionProgress] = useState("");
  const [importProgress, setImportProgress] = useState("");
  const [translationProgress, setTranslationProgress] = useState("");
  const [timingProgress, setTimingProgress] = useState("");
  const [replaceTrigger, setReplaceTrigger] =
    useState<HTMLButtonElement | null>(null);
  const importVisit = useRef(0);
  const lyricsInput = useRef<HTMLTextAreaElement>(null);
  const importLocked = !!history;
  function navigate(next: string) {
    if (screen !== next) {
      importVisit.current++;

      setImporting(false);
      setReplaceTrigger(null);
    }
    setScreen(next);
  }
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () =>
      header.parentElement?.style.setProperty(
        "--workbench-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const [removalId, setRemovalId] = useState<string | null>(null);
  const [lyricAction, setLyricAction] = useState(false);
  const [newLyric, setNewLyric] = useState("");
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState(false);
  const importDisabled = importLocked || importing || editingStructure;
  const [allowDraft, setAllowDraft] = useState(false);
  const [dialog, setDialog] = useState<"split" | "merge" | null>(null),
    [boundary, setBoundary] = useState(1),
    [leftPy, setLeftPy] = useState(""),
    [rightPy, setRightPy] = useState(""),
    [leftGloss, setLeftGloss] = useState(""),
    [rightGloss, setRightGloss] = useState("");
  const [projectSession, setProjectSession] = useState(0);
  const [translationExchanges, setTranslationExchanges] = useState<
    TranslationExchange[]
  >([]);
  const [dictionaryTerm, setDictionaryTerm] = useState<string | null>(null);
  const dialogReturnFocus = useRef<HTMLElement | null>(null);
  const focusReading = useRef(false);
  const selectedReading = useRef<HTMLInputElement>(null);
  const snapshot = history?.present,
    project = snapshot?.project,
    phrase = project?.phrases.find((p) => p.id === snapshot?.phraseId),
    selected = phrase?.words.find((w) => w.id === snapshot?.tokenId),
    index = phrase?.words.findIndex((w) => w.id === selected?.id) ?? -1,
    next = phrase?.words[index + 1];
  useEffect(() => {
    if (screen !== "Lyric editor" || !focusReading.current) return;
    focusReading.current = false;
    selectedReading.current?.focus();
  }, [screen, snapshot?.tokenId]);
  useEffect(() => {
    if (screen !== "Lyric editor") return;
    const list = document.querySelector<HTMLElement>(".phrase-list");
    const selected = list?.querySelector<HTMLElement>(".phrase.selected");
    if (!list || !selected) return;
    const item = selected.getBoundingClientRect(),
      bounds = list.getBoundingClientRect();
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth";
    if (item.top < bounds.top)
      list.scrollTo({ top: list.scrollTop + item.top - bounds.top, behavior });
    else if (item.bottom > bounds.bottom)
      list.scrollTo({
        top: list.scrollTop + item.bottom - bounds.bottom,
        behavior,
      });
  }, [snapshot?.phraseId, screen, query]);
  const insertionAfterId =
    screen === "Timing"
      ? snapshot?.occurrenceId
      : (project?.occurrences.find(
          (cue) =>
            cue.id === snapshot?.occurrenceId && cue.phraseId === phrase?.id,
        )?.id ??
        project?.occurrences.find((cue) => cue.phraseId === phrase?.id)?.id);
  const projectRef = useRef(project);
  projectRef.current = project;
  useEffect(() => {
    if (!project) return;
    try {
      localStorage.setItem(STORE, serializeProject(project));
      setSaved("Saved in this browser");
    } catch {
      setSaved("Browser storage unavailable · save JSON");
    }
  }, [project]);
  useEffect(() => {
    setAllowDraft(false);
  }, [project]);
  useEffect(() => {
    if (!dialog) return;
    const previous = dialogReturnFocus.current;
    const onKey = (e: KeyboardEvent) => {
      const panel = document.querySelector('[role="dialog"]');
      if (e.key === "Escape") {
        e.preventDefault();
        setDialog(null);
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const fields = [
        ...panel.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, textarea, select, a[href]",
        ),
      ];
      const first = fields[0],
        last = fields[fields.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [dialog]);
  const act = (fn: () => void) => {
    try {
      setError("");
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const change = (
    p: Project,
    selection: Partial<Snapshot> = {},
    preserveOrder = false,
  ) =>
    setHistory((h) =>
      h
        ? commit(h, {
            ...h.present,
            project: projectSchema.parse(
              preserveOrder ? p : orderGroupedProject(p),
            ),
            ...selection,
          })
        : initial(p),
    );
  const editPhrase = (updated: Phrase, tokenId = snapshot?.tokenId) => {
    if (project)
      change(
        {
          ...project,
          phrases: project.phrases.map((p) =>
            p.id === updated.id ? updated : p,
          ),
        },
        { tokenId },
      );
  };
  const updateWord = (id: string, patch: Partial<Word>) => {
    if (!phrase) return;
    const index = phrase.words.findIndex((word) => word.id === id);
    if (index < 0) return;
    let lyricKey = phrase.lyricKey;
    if (
      patch.hanzi !== undefined &&
      patch.hanzi !== phrase.words[index].hanzi
    ) {
      const spans = wordSpans(lyricKey, phrase.words);
      const span = spans.find(({ word }) => word.id === id);
      const following = spans.find(
        ({ word }) => phrase.words.indexOf(word) > index,
      );
      const at = span?.start ?? following?.start ?? lyricKey.length;
      lyricKey =
        lyricKey.slice(0, at) + patch.hanzi + lyricKey.slice(span?.end ?? at) ||
        lyricKey;
    }
    editPhrase({
      ...pending(phrase),
      lyricKey,
      words: phrase.words.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    });
  };
  const selectPhrase = (
    p: Phrase,
    tokenId = p.words[0]?.id ?? "",
    occurrenceId = project?.occurrences.find((cue) => cue.phraseId === p.id)
      ?.id,
  ) => {
    setDialog(null);
    setHistory((h) =>
      h
        ? {
            ...h,
            present: {
              ...h.present,
              phraseId: p.id,
              tokenId,
              occurrenceId,
            },
          }
        : h,
    );
  };
  const openProject = (p: Project) => {
    setLyricAction(false);
    setRemovalId(null);
    setRepeatOpen(false);
    setProjectSession((version) => version + 1);
    setTranslationExchanges([]);

    setDocumentSource({ text: "" });
    videoFiles.clear();
    setVideoTab("Video");
    setHistory(initial(p));
    setDialog(null);
    navigate("Lyric editor");
  };
  async function runImport(
    load: () => Promise<Project | string>,
    audio: File | null = null,
  ) {
    if (screen !== "Import lyrics" || importDisabled) return;
    const visit = ++importVisit.current;
    const before = projectRef.current;
    setImporting(true);
    setError("");
    try {
      const draft = await load();
      if (visit !== importVisit.current) return;
      if (projectRef.current !== before)
        throw Error(
          "The open project changed during import. Import again when ready.",
        );
      if (typeof draft === "string") {
        setDocumentSource({ text: draft });
      } else {
        setProjectAudio(audio);
        openProject(draft);
      }
    } catch (e) {
      if (visit === importVisit.current)
        setError(
          `${e instanceof Error ? e.message : String(e)}. Your import draft is still available.`,
        );
    } finally {
      if (visit === importVisit.current) setImporting(false);
    }
  }
  function read(file: File) {
    return runImport(async () => {
      if (file.size > 5_000_000) throw Error("Import limit is 5 MB");
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) return parseProject(text);
      if (file.name.toLowerCase().endsWith(".ts"))
        return importLegacy(text, file.name);
      if (file.name.toLowerCase().endsWith(".txt")) return text;
      throw Error("Choose a .txt, .ts or .json file");
    });
  }
  async function restoreDetectedReadings() {
    if (!project || !phrase || phrase.words.length || editingStructure) return;
    const base = project;
    setEditingStructure(true);
    setError("");
    try {
      const words = await draftDetectedWords(phrase.lyricKey);
      if (projectRef.current !== base)
        throw Error(
          "The project changed while preparing readings. Try again on the current lyric.",
        );
      change(
        {
          ...base,
          phrases: base.phrases.map((item) =>
            item.id === phrase.id ? { ...pending(item), words } : item,
          ),
        },
        { phraseId: phrase.id, tokenId: words[0]?.id ?? "" },
        true,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditingStructure(false);
    }
  }
  async function createLyric() {
    if (!project || editingStructure) return;
    const base = project;
    setEditingStructure(true);
    setError("");
    try {
      const draft = await draftRawLyrics(newLyric);
      if (draft.phrases.length !== 1 || draft.occurrences.length !== 1)
        throw Error("Enter one lyric line at a time.");
      if (projectRef.current !== base)
        throw Error(
          "The project changed while preparing the lyric. Your changes were retained; add it again when ready.",
        );
      const source = draft.phrases[0];
      const phrase: Phrase = {
        ...source,
        id: newId(),
        words: source.words.map((w) => ({ ...w, id: newId() })),
      };
      const appearanceId = newId();
      const updated = addLyric(base, phrase, insertionAfterId, appearanceId);
      const selectedPhrase = updated.phrases.find(
        (p) =>
          p.id ===
          updated.occurrences.find((o) => o.id === appearanceId)!.phraseId,
      )!;
      change(updated, {
        phraseId: selectedPhrase.id,
        tokenId: selectedPhrase.words[0]?.id ?? "",
        occurrenceId: appearanceId,
      });
      setNewLyric("");
      setQuery("");
      setLyricAction(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEditingStructure(false);
    }
  }
  const repeatLyric = (repeatId: string) => {
    if (!project) return;
    act(() => {
      const id = newId();
      change(repeatAppearance(project, repeatId, snapshot?.occurrenceId, id), {
        occurrenceId: id,
        phraseId: repeatId,
        tokenId:
          project.phrases.find((p) => p.id === repeatId)?.words[0]?.id ?? "",
      });
      setQuery("");
      setRepeatOpen(false);
    });
  };
  const deleteAppearance = (id: string) => {
    if (!project) return;
    act(() => {
      const at = project.occurrences.findIndex((o) => o.id === id);
      const updated = removeAppearance(project, id);
      const next =
        updated.occurrences[Math.min(at, updated.occurrences.length - 1)];
      const nextPhrase =
        updated.phrases.find((p) => p.id === next?.phraseId) ??
        updated.phrases[0];
      change(updated, {
        occurrenceId: next?.id,
        phraseId: nextPhrase?.id ?? "",
        tokenId: nextPhrase?.words[0]?.id ?? "",
      });
    });
  };
  function populateSplit(at: number) {
    if (!selected || !project) return;
    const suggestion = splitSuggestions(selected, at, project.phrases);
    setBoundary(at);
    setLeftPy(suggestion.leftPinyin);
    setRightPy(suggestion.rightPinyin);
    setLeftGloss(suggestion.leftGloss);
    setRightGloss(suggestion.rightGloss);
  }
  function openDialog(kind: "split" | "merge") {
    dialogReturnFocus.current = document.activeElement as HTMLElement | null;
    if (!selected) return;
    setBoundary(1);
    setLeftPy(
      kind === "merge"
        ? joinReadings([selected.pinyin, next?.pinyin ?? ""])
        : "",
    );
    setRightPy("");
    setLeftGloss(
      kind === "merge"
        ? [selected.translation.en, next?.translation.en].join("; ")
        : "",
    );
    setRightGloss("");
    if (kind === "split") populateSplit(1);
    setDialog(kind);
  }
  const workspaces = [
    ["Import lyrics", "Import"],
    ["Lyric editor", "Translations"],
    ["Timing", "Timing"],
    ["Video settings", "Video"],
    ["Export data", "Export"],
  ];
  const activeWorkspace =
    screen === "Song structure" ? "Import lyrics" : screen;
  function openWorkspace(name: string) {
    navigate(name);
    setRepeatOpen(false);
    setError("");
    setDialog(null);
  }
  const counts: Record<string, string> = project
    ? {
        "Lyric editor":
          project.phrases.filter((p) => p.review === "reviewed").length +
          "/" +
          project.phrases.length,
        Timing:
          project.occurrences.filter(
            (o) => timingStatus(o, project.audio?.durationMs) === "Reviewed",
          ).length +
          "/" +
          project.occurrences.length,
      }
    : {};
  const projectName = project
    ? [project.metadata.title || "Untitled song", project.metadata.artist]
        .filter(Boolean)
        .join(" · ")
    : "Lyric Workbench";
  const pendingImportSplits =
    project?.timingRun?.candidates.some(needsImportSplit);
  const jobs: Record<string, string> = {
    "Import lyrics":
      importProgress || suggestionProgress || (pendingImportSplits ? "!" : ""),
    "Lyric editor":
      translationProgress ||
      (project?.translationWork?.drafts.length ? "!" : ""),
    Timing:
      timingProgress ||
      (project?.timingRun &&
      (project.timingRun.candidates.some((c) => !needsImportSplit(c)) ||
        project.occurrences.some(
          (o) =>
            (o.automaticTiming || o.timingIssue) &&
            o.timingReview !== "reviewed",
        ))
        ? "!"
        : ""),
  };
  const warnings = project ? exportIssues(project) : [];
  return (
    <div className="app">
      <main>
        <header ref={headerRef}>
          <div className="project-identity">
            <span className="music-mark" aria-hidden="true">
              ♫
            </span>
            <strong>Lyric Workbench</strong>
            <small title={[projectName, saved].join(" · ")}>
              v{version}
              {project && " · " + projectName} {saved && " · " + saved}
            </small>
          </div>
          <nav className="workflow-tabs" aria-label="Workspaces">
            {workspaces.map(([name, label], index) => (
              <button
                key={name}
                data-workspace={name}
                aria-current={activeWorkspace === name ? "page" : undefined}
                onClick={() => openWorkspace(name)}
              >
                <span
                  className="step-marker"
                  data-complete={name === "Import lyrics" && !!project}
                  aria-hidden="true"
                >
                  {name === "Import lyrics" && project ? "✓" : index + 1}
                </span>
                {label}{" "}
                {jobs[name] && (
                  <b
                    aria-label={
                      jobs[name] === "!" ? "Needs attention" : jobs[name]
                    }
                  >
                    {jobs[name]}
                  </b>
                )}
                {counts[name] && <small> {counts[name]}</small>}
              </button>
            ))}
          </nav>
          <label className="workspace-picker">
            Workspace
            <select
              value={activeWorkspace}
              onChange={(e) => openWorkspace(e.target.value)}
            >
              {workspaces.map(([name, label]) => (
                <option value={name} key={name}>
                  {jobs[name]}
                  {label} {counts[name]}
                </option>
              ))}
            </select>
          </label>
          <span className="mobile-job" role="status">
            {workspaces
              .filter(([name]) => jobs[name])
              .map(([name, label]) => label + " " + jobs[name])
              .join(" · ")}
          </span>
          <div className="actions">
            <button
              disabled={
                importing ||
                editingStructure ||
                (editorHistory ? !editorHistory.undo : !history?.past.length)
              }
              onClick={() => {
                if (editorHistory) {
                  editorHistory.undo?.();
                  return;
                }
                setHistory((h) => (h ? undo(h) : h));
                setDialog(null);
              }}
            >
              Undo
            </button>
            <button
              disabled={
                importing ||
                editingStructure ||
                (editorHistory ? !editorHistory.redo : !history?.future.length)
              }
              onClick={() => {
                if (editorHistory) {
                  editorHistory.redo?.();
                  return;
                }
                setHistory((h) => (h ? redo(h) : h));
                setDialog(null);
              }}
            >
              Redo
            </button>
            <button
              disabled={!project}
              onClick={() =>
                project &&
                download("song.workbench.json", serializeProject(project, 2))
              }
            >
              Download project JSON
            </button>
          </div>
        </header>
        <div
          className="content"
          onDragOver={(e) => {
            if (
              screen === "Import lyrics" &&
              e.dataTransfer.types.includes("Files")
            )
              e.preventDefault();
          }}
          onDrop={(e) => {
            if (screen !== "Import lyrics") return;
            const file = e.dataTransfer.files[0];
            if (!file) return;
            e.preventDefault();
            if (!project) void read(file);
          }}
        >
          <h1>
            {screen === "Lyric editor"
              ? "Translate & review"
              : project && screen === "Import lyrics"
                ? "Song structure"
                : screen}
          </h1>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {(!project || screen === "Import lyrics") && (
            <div hidden={screen !== "Import lyrics"}>
              {project && pendingImportSplits && (
                <ImportAudioSplits
                  project={project}
                  file={projectAudio}
                  verifiedAudio={splitAudio}
                  active
                  apply={(p) => change(p, {}, true)}
                />
              )}
              {replaceTrigger && (
                <TimingConfirmDialog
                  cancelLabel="Keep project"
                  extraAction={
                    project && (
                      <button
                        onClick={() =>
                          download(
                            "song.workbench.json",
                            serializeProject(project, 2),
                          )
                        }
                      >
                        Download project JSON
                      </button>
                    )
                  }
                  title="Replace current project?"
                  action="Discard project and start import"
                  trigger={replaceTrigger}
                  onCancel={() => setReplaceTrigger(null)}
                  onConfirm={() => {
                    setReplaceTrigger(null);
                    try {
                      localStorage.removeItem(STORE);
                    } catch {
                      setError("Could not remove the saved project.");
                      return;
                    }
                    setHistory(null);
                    setProjectAudio(null);
                    setSaved("");
                    setTranslationExchanges([]);
                    requestAnimationFrame(() => lyricsInput.current?.focus());
                  }}
                >
                  Starting a new import will discard this project and its undo
                  history.{" "}
                </TimingConfirmDialog>
              )}
              {!project && (
                <fieldset disabled={importDisabled} className="import-fields">
                  <DocumentImport
                    publishHistory={setEditorHistory}
                    key={projectSession}
                    source={documentSource}
                    editor={lyricsInput}
                    active={screen === "Import lyrics"}
                    locked={importLocked}
                    reportAI={setSuggestionProgress}
                    reportAudio={setImportProgress}
                    runImport={runImport}
                  />
                  <section>
                    <h2>Open a saved project or legacy song</h2>
                    <p>
                      Open project JSON or a legacy TypeScript song. Choose a
                      .txt file to fill the lyrics field.
                    </p>
                    <label className="file">
                      Choose .ts, .txt or project .json
                      <input
                        type="file"
                        accept=".ts,.txt,.json"
                        aria-label="Song file"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void read(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </section>
                </fieldset>
              )}
            </div>
          )}
          {project &&
            (screen === "Song structure" || screen === "Import lyrics") && (
              <ProjectStructure
                publishHistory={setEditorHistory}
                project={project}
                selectedId={snapshot?.occurrenceId}
                cancel={() => navigate("Timing")}
                apply={(p) => {
                  change(p, {}, true);
                  navigate("Timing");
                }}
              />
            )}
          {project && screen === "Import lyrics" && (
            <div className="import-replacement">
              <button onClick={(e) => setReplaceTrigger(e.currentTarget)}>
                Import another song…
              </button>
            </div>
          )}
          {project && screen === "Timing" && (
            <div className="lyric-structure-actions">
              <button onClick={() => navigate("Song structure")}>
                Edit song structure
              </button>
              <button
                disabled={editingStructure || !project.phrases.length}
                aria-haspopup="dialog"
                onClick={() => setRepeatOpen(true)}
              >
                Repeat
              </button>
            </div>
          )}
          {project && lyricAction && screen === "Lyric editor" && (
            <section
              id="lyric-structure-panel"
              className="lyric-structure-panel"
              aria-label="Add lyric"
            >
              <p>
                Insert after the selected lyric, or at the end if none is
                selected. A new lyric starts at its predecessor’s end for up to
                two seconds where space is available; otherwise timing stays
                unassigned.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void createLyric();
                }}
              >
                <label>
                  New lyric
                  <input
                    value={newLyric}
                    onChange={(e) => setNewLyric(e.target.value)}
                    disabled={editingStructure}
                  />
                </label>
                <button disabled={editingStructure || !newLyric.trim()}>
                  {editingStructure ? "Preparing word draft…" : "Add new lyric"}
                </button>
              </form>
            </section>
          )}
          {screen === "Lyric editor" && !project && (
            <section>Import a song first.</section>
          )}
          {project && (
            <TranslateLyrics
              report={setTranslationProgress}
              key={projectSession}
              hidden={screen !== "Lyric editor"}
              project={project}
              phrase={phrase}
              exchanges={translationExchanges}
              setExchanges={setTranslationExchanges}
              secondaryAction={
                <button
                  aria-expanded={lyricAction}
                  aria-controls="lyric-structure-panel"
                  disabled={editingStructure}
                  onClick={() => setLyricAction(!lyricAction)}
                >
                  Add lyric
                </button>
              }
              selectPhrase={(target) => {
                setQuery("");
                selectPhrase(target);
              }}
              update={(edit, phraseId) =>
                setHistory((h) => {
                  if (
                    !h ||
                    (phraseId &&
                      !h.present.project.phrases.some(
                        (item) => item.id === phraseId,
                      ))
                  )
                    return h;
                  return {
                    ...h,
                    present: {
                      ...h.present,
                      project: {
                        ...h.present.project,
                        translationWork: edit(
                          translationState(h.present.project),
                        ),
                      },
                    },
                  };
                })
              }
              apply={(edit) =>
                setHistory((h) => {
                  if (!h) return h;
                  const updated = edit(h.present.project);
                  if (updated === h.present.project) return h;
                  const words =
                    updated.phrases.find(
                      (item) => item.id === h.present.phraseId,
                    )?.words ?? [];
                  return commit(h, {
                    ...h.present,
                    project: projectSchema.parse(updated),
                    tokenId: words.some((word) => word.id === h.present.tokenId)
                      ? h.present.tokenId
                      : (words[0]?.id ?? ""),
                  });
                })
              }
            >
              {(preview, reviewActions) => {
                const proposedWords = preview.vocabulary;
                const words =
                  proposedWords?.words.map((word, i) => ({
                    ...word,
                    id:
                      phrase?.words[i]?.hanzi === word.hanzi
                        ? phrase.words[i].id
                        : `proposal-${i}`,
                  })) ??
                  phrase?.words ??
                  [];
                const inspectorWord =
                  words.find((word) => word.id === snapshot?.tokenId) ??
                  words[0];
                const reviewIssues = phrase
                  ? phraseIssues({
                      ...phrase,
                      words,
                      translation: {
                        en:
                          preview.sentences.en?.value ?? phrase.translation.en,
                        pl:
                          preview.sentences.pl?.value ?? phrase.translation.pl,
                      },
                    })
                  : [];
                return (
                  <div className="workspace">
                    <section className="phrases">
                      <h2>
                        Unique phrases <small>{project.phrases.length}</small>
                      </h2>
                      <label>
                        Search
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Hanzi or translation"
                        />
                      </label>
                      <div className="phrase-list">
                        {phrasesInAppearanceOrder(project)
                          .filter((p) =>
                            `${p.lyricKey} ${p.translation.en} ${p.translation.pl}`
                              .toLowerCase()
                              .includes(query.toLowerCase()),
                          )
                          .map((p, i) => (
                            <button
                              className={`phrase ${phrase?.id === p.id ? "selected" : ""}`}
                              key={p.id}
                              onClick={() => selectPhrase(p)}
                            >
                              <small>
                                {i + 1} ·{" "}
                                {
                                  project.occurrences.filter(
                                    (o) => o.phraseId === p.id,
                                  ).length
                                }{" "}
                                occurrences · {p.review}
                              </small>
                              {project.translationWork?.drafts.some(
                                (draft) => draft.phraseId === p.id,
                              ) && <small> · Draft ready</small>}
                              <strong>{p.lyricKey}</strong>
                              <span lang="en">
                                {p.translation.en || "No English translation"}
                              </span>
                              <span lang="pl">
                                {p.translation.pl || "Brak tłumaczenia"}
                              </span>
                              {lyricCount(p.lyricKey) > lyricLimit && (
                                <small className="warning">
                                  {lyricCount(p.lyricKey)} / {lyricLimit} lyric
                                  characters
                                </small>
                              )}
                            </button>
                          ))}
                      </div>
                    </section>
                    {phrase && (
                      <>
                        <section className="editor">
                          <div className="two sentence-fields">
                            {(["en", "pl"] as const).map((language) => {
                              const draft = preview.sentences[language];
                              const label =
                                language === "en" ? "English" : "Polish";
                              return (
                                <div key={language}>
                                  <label>
                                    {label}
                                    {draft && " · Draft"}
                                    <input
                                      aria-label={`${label} sentence`}
                                      className={draft && "draft-field"}
                                      readOnly={draft?.readOnly}
                                      value={
                                        draft?.value ??
                                        phrase.translation[language]
                                      }
                                      onChange={(e) =>
                                        draft
                                          ? draft.edit(e.target.value)
                                          : editPhrase({
                                              ...phrase,
                                              review: "pending",
                                              translation: {
                                                ...phrase.translation,
                                                [language]: e.target.value,
                                              },
                                            })
                                      }
                                    />
                                    {draft?.previous &&
                                      draft.previous !== draft.value && (
                                        <small className="draft-previous">
                                          Previous · {draft.previous}
                                        </small>
                                      )}
                                  </label>
                                  {preview.actions[language]}
                                </div>
                              );
                            })}
                          </div>
                          {project.phrases.some(
                            (other) =>
                              other.id !== phrase.id &&
                              other.lyricKey === phrase.lyricKey,
                          ) && (
                            <p role="status" className="warning">
                              Duplicate lyric text. Keep translations and word
                              breakdowns consistent before TypeScript export.
                            </p>
                          )}
                          {reviewActions}
                          <h2>
                            Word breakdown{" "}
                            {proposedWords && <small>· Draft</small>}
                          </h2>
                          {preview.actions.vocabulary}
                          {proposedWords?.previousBoundaries && (
                            <p className="draft-previous">
                              Previous word boundaries ·{" "}
                              {proposedWords.previousBoundaries}
                            </p>
                          )}
                          {!proposedWords &&
                            phrase.words.length === 0 &&
                            hanzi(phrase.lyricKey) &&
                            project.occurrences.some(
                              (cue) =>
                                cue.phraseId === phrase.id &&
                                cue.detectedFromAudio,
                            ) && (
                              <button
                                disabled={editingStructure}
                                onClick={() => void restoreDetectedReadings()}
                              >
                                Draft words and Pinyin
                              </button>
                            )}

                          {!proposedWords && (
                            <div className="actions wrap">
                              <button
                                onClick={() => {
                                  const id = newId();
                                  editPhrase(
                                    {
                                      ...pending(phrase),
                                      words: [
                                        ...phrase.words,
                                        {
                                          id,
                                          hanzi: "",
                                          pinyin: "",
                                          translation: { en: "" },
                                        },
                                      ],
                                    },
                                    id,
                                  );
                                }}
                              >
                                Add word
                              </button>
                              <button
                                disabled={
                                  !selected ||
                                  [...selected.hanzi].length < 2 ||
                                  hanzi(selected.hanzi) !== selected.hanzi
                                }
                                onClick={() => openDialog("split")}
                              >
                                Split word
                              </button>
                              <button
                                disabled={!selected?.hanzi || !next?.hanzi}
                                onClick={() => openDialog("merge")}
                              >
                                Merge with next
                              </button>
                              <button
                                disabled={!selected}
                                onClick={() => {
                                  const span = wordSpans(
                                    phrase.lyricKey,
                                    phrase.words,
                                  ).find(
                                    ({ word }) => word.id === selected?.id,
                                  );
                                  const lyricKey = span
                                    ? phrase.lyricKey.slice(0, span.start) +
                                        phrase.lyricKey.slice(span.end) ||
                                      phrase.lyricKey
                                    : phrase.lyricKey;
                                  editPhrase(
                                    {
                                      ...pending(phrase),
                                      lyricKey,
                                      words: phrase.words.filter(
                                        (w) => w.id !== selected?.id,
                                      ),
                                    },
                                    phrase.words[index - 1]?.id ?? "",
                                  );
                                }}
                              >
                                Remove selected
                              </button>
                            </div>
                          )}
                          <div className="tokens">
                            <div className="token headings">
                              <span aria-hidden="true"></span>
                              <span>Hanzi</span>
                              <span>Pinyin</span>
                              <span>English gloss</span>
                              <span>Move</span>
                            </div>
                            {words.map((w, i) => {
                              const reading = proposedWords?.pinyin(i);
                              const gloss = proposedWords?.gloss(i);
                              return (
                                <div
                                  className={`token ${inspectorWord?.id === w.id ? "selected" : ""}`}
                                  key={w.id}
                                  onFocusCapture={() =>
                                    setHistory((h) =>
                                      h
                                        ? {
                                            ...h,
                                            present: {
                                              ...h.present,
                                              tokenId: w.id,
                                            },
                                          }
                                        : h,
                                    )
                                  }
                                >
                                  <span
                                    className="word-index"
                                    aria-hidden="true"
                                  >
                                    {i + 1}
                                  </span>
                                  <input
                                    aria-label={`Hanzi ${i + 1}`}
                                    value={w.hanzi}
                                    readOnly={!!proposedWords}
                                    placeholder="Hanzi"
                                    onChange={(e) =>
                                      updateWord(w.id, {
                                        hanzi: e.target.value,
                                      })
                                    }
                                  />
                                  <div>
                                    <input
                                      aria-label={`Pinyin ${i + 1}`}
                                      ref={
                                        w.id === snapshot?.tokenId
                                          ? selectedReading
                                          : undefined
                                      }
                                      className={
                                        reading &&
                                        reading.value !== reading.previous
                                          ? "draft-field"
                                          : undefined
                                      }
                                      readOnly={
                                        proposedWords
                                          ? (reading?.readOnly ?? true)
                                          : undefined
                                      }
                                      value={w.pinyin}
                                      placeholder={
                                        w.hanzi ? "Reading needs review" : ""
                                      }
                                      onChange={(e) =>
                                        reading
                                          ? reading.edit(e.target.value)
                                          : updateWord(w.id, {
                                              pinyin: e.target.value,
                                            })
                                      }
                                    />
                                    {reading?.previous &&
                                      reading.previous !== reading.value && (
                                        <small className="draft-previous">
                                          Previous · {reading.previous}
                                        </small>
                                      )}
                                    {!proposedWords &&
                                      w.hanzi &&
                                      /\s/u.test(w.pinyin) && (
                                        <button
                                          className="compact"
                                          onClick={() =>
                                            updateWord(w.id, {
                                              pinyin: fixSpacing(w.pinyin),
                                            })
                                          }
                                        >
                                          Fix spacing
                                        </button>
                                      )}
                                  </div>
                                  <div>
                                    <GlossInput
                                      aria-label={`Gloss ${i + 1}`}
                                      data-draft={
                                        gloss && gloss.value !== gloss.previous
                                          ? true
                                          : undefined
                                      }
                                      readOnly={
                                        proposedWords
                                          ? (gloss?.readOnly ?? true)
                                          : undefined
                                      }
                                      value={w.translation.en}
                                      onChange={(e) =>
                                        gloss
                                          ? gloss.edit(e.target.value)
                                          : updateWord(w.id, {
                                              translation: {
                                                en: e.target.value,
                                              },
                                            })
                                      }
                                    />
                                    {gloss?.previous &&
                                      gloss.previous !== gloss.value && (
                                        <small className="draft-previous">
                                          Previous · {gloss.previous}
                                        </small>
                                      )}
                                  </div>
                                  <div className="move">
                                    {[-1, 1].map((d) => (
                                      <button
                                        key={d}
                                        aria-label={`${d < 0 ? "Move up" : "Move down"} word ${i + 1}`}
                                        disabled={
                                          !!proposedWords ||
                                          !phrase.words[i + d]
                                        }
                                        onClick={() => {
                                          const words = [...phrase.words];
                                          [words[i], words[i + d]] = [
                                            words[i + d],
                                            words[i],
                                          ];
                                          const ids = new Set([
                                            w.id,
                                            phrase.words[i + d].id,
                                          ]);
                                          const [left, right] = wordSpans(
                                            phrase.lyricKey,
                                            phrase.words,
                                          ).filter(({ word }) =>
                                            ids.has(word.id),
                                          );
                                          const lyricKey =
                                            left && right
                                              ? phrase.lyricKey.slice(
                                                  0,
                                                  left.start,
                                                ) +
                                                right.word.hanzi +
                                                phrase.lyricKey.slice(
                                                  left.end,
                                                  right.start,
                                                ) +
                                                left.word.hanzi +
                                                phrase.lyricKey.slice(right.end)
                                              : phrase.lyricKey;
                                          editPhrase({
                                            ...pending(phrase),
                                            lyricKey,
                                            words,
                                          });
                                        }}
                                      >
                                        {d < 0 ? "↑" : "↓"}
                                      </button>
                                    ))}
                                  </div>
                                  {inspectorWord?.id === w.id &&
                                    preview.wordAction?.(i)}
                                </div>
                              );
                            })}
                          </div>
                          {reviewIssues.length > 0 && (
                            <details className="review-warnings">
                              <summary className="warning">
                                {reviewIssues.length} review warnings
                              </summary>
                              <ul>
                                {reviewIssues.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                          <button
                            className={
                              phrase.review === "reviewed"
                                ? undefined
                                : "primary"
                            }
                            disabled={
                              phrase.review !== "reviewed" &&
                              (!!proposedWords ||
                                Object.keys(preview.sentences).length > 0)
                            }
                            onClick={() =>
                              act(() => {
                                if (phrase.review === "reviewed") {
                                  editPhrase({ ...phrase, review: "pending" });
                                  return;
                                }
                                const issues = phraseIssues(phrase);
                                if (issues.length)
                                  throw Error(issues.join("; "));
                                editPhrase({
                                  ...phrase,
                                  review: "reviewed",
                                  segmentationApproved: true,
                                });
                              })
                            }
                          >
                            {phrase.review === "reviewed"
                              ? "Mark as needing review"
                              : "Mark phrase reviewed"}
                          </button>
                        </section>
                        <section className="inspector">
                          <DictionaryLookup
                            word={inspectorWord}
                            onPick={
                              proposedWords
                                ? undefined
                                : (entry) =>
                                    updateWord(inspectorWord.id, {
                                      pinyin: fixSpacing(entry.pinyin),
                                    })
                            }
                            advice={{
                              provider: preview.wordProvider,
                              text: phrase.lyricKey,
                              position: phrase.lyricKey.indexOf(
                                inspectorWord?.hanzi ?? "",
                                words
                                  .slice(0, words.indexOf(inspectorWord))
                                  .reduce(
                                    (offset, w) =>
                                      phrase.lyricKey.indexOf(w.hanzi, offset) +
                                      w.hanzi.length,
                                    0,
                                  ),
                              ),
                            }}
                            onOpenWiktionary={setDictionaryTerm}
                          />
                          <hr />
                          <h2>Timing</h2>
                          <p>
                            Edit timing for each appearance of this lyric.
                            Translation changes apply to all.
                          </p>
                          <ol className="lyric-timing-list">
                            {project.occurrences
                              .filter((o) => o.phraseId === phrase.id)
                              .map((o, appearanceIndex) => (
                                <li key={o.id}>
                                  <div className="lyric-timing-row">
                                    <button
                                      className="lyric-timing-link"
                                      data-timing-id={o.id}
                                      onClick={() => {
                                        setHistory((h) =>
                                          h
                                            ? {
                                                ...h,
                                                present: {
                                                  ...h.present,
                                                  occurrenceId: o.id,
                                                },
                                              }
                                            : h,
                                        );
                                        setScreen("Timing");
                                        setError("");
                                        setDialog(null);
                                      }}
                                    >
                                      <span className="lyric-timing-copy">
                                        {o.detectedFromAudio === true &&
                                          phrase.review !== "reviewed" && (
                                            <span className="detected-audio-badge">
                                              Detected from audio
                                            </span>
                                          )}
                                        <span className="lyric-timing-range">
                                          {o.startMs === null &&
                                          o.endMs === null
                                            ? "Timing not set"
                                            : `${formatTime(o.startMs)} → ${formatTime(o.endMs)}`}
                                        </span>
                                      </span>
                                      <svg
                                        aria-hidden="true"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      >
                                        <path d="m9 5 7 7-7 7" />
                                      </svg>
                                    </button>
                                    <button
                                      className="lyric-timing-remove"
                                      aria-label={`Remove appearance ${appearanceIndex + 1}`}
                                      title="Remove this appearance"
                                      onClick={() => setRemovalId(o.id)}
                                    >
                                      <span aria-hidden="true">×</span>
                                    </button>
                                  </div>
                                </li>
                              ))}
                          </ol>
                        </section>
                      </>
                    )}
                  </div>
                );
              }}
            </TranslateLyrics>
          )}
          {screen === "Export data" && project && (
            <div className="two">
              <AssetContext.Provider value={videoFiles}>
                <div>
                  <VideoDownload project={project} file={projectAudio} />
                  <StudioHandoff
                    save={(videoSettings) =>
                      change({ ...project, videoSettings }, {}, true)
                    }
                    openVideo={(tab) => {
                      setVideoTab(tab);
                      navigate("Video settings");
                    }}
                    project={project}
                    file={projectAudio}
                    download={download}
                  />
                </div>
              </AssetContext.Provider>
              <section>
                <h2>Review & compatibility</h2>
                {conflictingLyrics(project).length > 0 && (
                  <p role="alert">
                    Resolve conflicting duplicate lyrics before TypeScript
                    export: {conflictingLyrics(project).join(", ")}
                  </p>
                )}
                <p>
                  {project.phrases.length} phrases ·{" "}
                  {project.occurrences.length} ordered occurrences
                </p>
                <ul className="warnings">
                  {warnings.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
                {warnings.length > 0 && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={allowDraft}
                      onChange={(e) => setAllowDraft(e.target.checked)}
                    />
                    I have read the warnings. Export an incomplete draft
                    preserving my data.
                  </label>
                )}
                <button
                  className="primary"
                  disabled={
                    conflictingLyrics(project).length > 0 ||
                    (warnings.length > 0 && !allowDraft)
                  }
                  onClick={() =>
                    act(() => download("Song.ts", exportLegacy(project)))
                  }
                >
                  Download legacy TypeScript
                </button>
                <p>
                  Manually place the downloaded module in src/ and reference it
                  in the existing composition. Nothing is overwritten
                  automatically. Unassigned timing exports as explicit zero
                  placeholders.
                </p>
                <button
                  onClick={() =>
                    download(
                      "song.workbench.json",
                      serializeProject(project, 2),
                    )
                  }
                >
                  Download project JSON
                </button>
              </section>
              <section>
                <h2>Legacy song output</h2>
                <pre>
                  {conflictingLyrics(project).length
                    ? "Resolve duplicate lyric conflicts to preview TypeScript."
                    : exportLegacy(project)}
                </pre>
              </section>
            </div>
          )}
          {screen === "Export data" && !project && (
            <section>Import a song first.</section>
          )}
          {project && (
            <div hidden={screen !== "Timing"}>
              <TimingEditor
                report={setTimingProgress}
                key={projectSession}
                localFile={projectAudio}
                onSplitAudioReady={setSplitAudio}
                onFile={setProjectAudio}
                project={project}
                active={screen === "Timing"}
                selectedId={snapshot?.occurrenceId}
                onSelect={(id) =>
                  setHistory((h) =>
                    h
                      ? { ...h, present: { ...h.present, occurrenceId: id } }
                      : h,
                  )
                }
                onChange={(p, id, preserveOrder) => {
                  if (p !== project) {
                    const occurrence = p.occurrences.find((o) => o.id === id);
                    const selectedPhrase =
                      p.phrases.find(
                        (phrase) => phrase.id === occurrence?.phraseId,
                      ) ?? p.phrases[0];
                    change(
                      p,
                      screen !== "Timing"
                        ? {}
                        : {
                            occurrenceId: occurrence?.id,
                            phraseId: selectedPhrase?.id ?? "",
                            tokenId: selectedPhrase?.words[0]?.id ?? "",
                          },
                      preserveOrder,
                    );
                  }
                }}
                onRemove={setRemovalId}
                onAudioMetadata={(audio) =>
                  setHistory((h) => (h ? attachAudioMetadata(h, audio) : h))
                }
                onReview={(occurrenceId, wordId) => {
                  const occurrence = project.occurrences.find(
                    (cue) => cue.id === occurrenceId,
                  );
                  const target = project.phrases.find(
                    (p) => p.id === occurrence?.phraseId,
                  );
                  if (!target) return;
                  if (wordId !== undefined) setQuery("");
                  focusReading.current = wordId !== undefined;
                  selectPhrase(target, wordId, occurrenceId);
                  setScreen("Lyric editor");
                }}
                onUndo={() => setHistory((h) => (h ? undo(h) : h))}
                onRedo={() => setHistory((h) => (h ? redo(h) : h))}
              />
            </div>
          )}
          {screen === "Timing" && !project && (
            <section>Import a song first.</section>
          )}
          {screen === "Video settings" &&
            (project ? (
              <AssetContext.Provider value={videoFiles}>
                <FootageSettings
                  tab={videoTab}
                  setTab={setVideoTab}
                  goExport={() => navigate("Export data")}
                  file={projectAudio}
                  project={project}
                  save={(videoSettings) =>
                    change({ ...project, videoSettings }, {}, true)
                  }
                />
              </AssetContext.Provider>
            ) : (
              <section>Import a song first.</section>
            ))}
          {project &&
            removalId &&
            (() => {
              const cue = project.occurrences.find((o) => o.id === removalId);
              const lyric = project.phrases.find((p) => p.id === cue?.phraseId);
              return cue && lyric ? (
                <RemoveAppearanceDialog
                  lyric={lyric.lyricKey}
                  last={
                    project.occurrences.filter((o) => o.phraseId === lyric.id)
                      .length === 1
                  }
                  onCancel={() => setRemovalId(null)}
                  onConfirm={() => {
                    deleteAppearance(removalId);
                    setRemovalId(null);
                  }}
                />
              ) : null;
            })()}
          {project && repeatOpen && (
            <RepeatLyricDialog
              phrases={project.phrases}
              initialId={
                project.occurrences.find(
                  (cue) => cue.id === snapshot?.occurrenceId,
                )?.phraseId ?? phrase?.id
              }
              onCancel={() => setRepeatOpen(false)}
              onConfirm={repeatLyric}
            />
          )}
          {dictionaryTerm && (
            <WiktionaryDialog
              term={dictionaryTerm}
              onClose={() => setDictionaryTerm(null)}
            />
          )}
          {dialog && phrase && selected && (
            <div className="backdrop">
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                className="dialog"
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(() => {
                      const updated =
                        dialog === "merge"
                          ? mergeAdjacentTokens(phrase, selected.id, {
                              pinyin: leftPy,
                              glossOverride: leftGloss,
                            })
                          : splitToken(phrase, selected.id, {
                              hanziBoundary: boundary,
                              leftPinyin: leftPy,
                              rightPinyin: rightPy,
                              leftGloss,
                              rightGloss,
                            });
                      editPhrase(updated, selected.id);
                      setDialog(null);
                    });
                  }}
                >
                  <h2 id="dialog-title">
                    {dialog === "merge" ? "Merge adjacent words" : "Split word"}
                  </h2>
                  <p>
                    Original reading: {selected.pinyin}
                    {dialog === "merge" ? ` + ${next?.pinyin}` : ""}. Confirm
                    the suggested readings and meanings before confirming.
                  </p>
                  {dialog === "merge" ? (
                    <h3>
                      {selected.hanzi}
                      {next?.hanzi}
                    </h3>
                  ) : (
                    <label>
                      Split between characters
                      <select
                        value={boundary}
                        onChange={(e) => populateSplit(Number(e.target.value))}
                      >
                        {[...selected.hanzi].slice(1).map((_, i) => (
                          <option key={i} value={i + 1}>
                            {[...selected.hanzi].slice(0, i + 1).join("")} |{" "}
                            {[...selected.hanzi].slice(i + 1).join("")}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    {dialog === "merge"
                      ? "Combined Pinyin"
                      : `${[...selected.hanzi].slice(0, boundary).join("")} — Pinyin`}
                    <input
                      autoFocus
                      value={leftPy}
                      onChange={(e) => setLeftPy(e.target.value)}
                    />
                  </label>
                  <label>
                    {dialog === "merge"
                      ? "Combined English gloss (edit the meaning)"
                      : "Left English gloss"}
                    <textarea
                      value={leftGloss}
                      onChange={(e) => setLeftGloss(e.target.value)}
                    />
                  </label>
                  {dialog === "split" && (
                    <>
                      <label>
                        {[...selected.hanzi].slice(boundary).join("")} — Pinyin
                        <input
                          value={rightPy}
                          onChange={(e) => setRightPy(e.target.value)}
                        />
                      </label>
                      <label>
                        Right English gloss
                        <textarea
                          value={rightGloss}
                          onChange={(e) => setRightGloss(e.target.value)}
                        />
                      </label>
                    </>
                  )}
                  <p>
                    Readings are prefilled when the original Pinyin has an
                    unambiguous syllable alignment. Meanings are reused from
                    matching words elsewhere in this project; otherwise, enter
                    them yourself. A compound’s meaning cannot reliably be
                    divided between its characters.
                  </p>
                  <p>
                    This change needs review. Undo restores the original word.
                  </p>
                  <div className="actions">
                    <button type="button" onClick={() => setDialog(null)}>
                      Cancel
                    </button>
                    <button type="submit" className="primary">
                      Confirm {dialog} draft
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
