import { useEffect, useRef, useState } from "react";
import type { VerifiedSplitAudio } from "./AutomaticTiming";
import { ExportWorkspace } from "./ExportWorkspace";
import { FootageSettings } from "./FootageSettings.tsx";
import { ImportWorkspace } from "./ImportWorkspace";
import { PhraseEditor } from "./PhraseEditor";
import { PhraseInspector } from "./PhraseInspector";
import { PhraseList } from "./PhraseList";
import { RemoveAppearanceDialog } from "./RemoveAppearanceDialog";
import { RepeatLyricDialog } from "./RepeatLyricDialog";
import { TimingEditor } from "./TimingEditor";
import {
  TranslateLyrics,
  type TranslationExchange,
} from "./TranslateLyrics.tsx";
import { WiktionaryDialog } from "./WiktionaryDialog";
import { WordStructureDialog } from "./WordStructureDialog";
import { WorkbenchHeader } from "./WorkbenchHeader";
import { needsImportSplit } from "./automatic-timing";
import {
  History,
  Phrase,
  Project,
  Snapshot,
  Word,
  addLyric,
  commit,
  newId,
  parseProject,
  pending,
  phraseIssues,
  projectSchema,
  redo,
  removeAppearance,
  repeatAppearance,
  serializeProject,
  undo,
} from "./domain";
import { importLegacy } from "./legacy";
import type { LyricField } from "./lyric-field.ts";
import { orderGroupedProject } from "./lyric-groups.ts";
import { draftDetectedWords, draftRawLyrics } from "./raw-import";
import { attachAudioMetadata, withTimingBaseline } from "./timing.ts";
import { translationState } from "./translation.ts";
import type { EditorHistory } from "./useEditorHistory";
import { AssetContext, useVideoFiles } from "./video-assets.tsx";
import { wordSpans } from "./word-spans";

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
  const lyricsInput = useRef<LyricField>(null);
  const importLocked = !!history;
  function navigate(next: string) {
    if (screen !== next) {
      importVisit.current++;

      setImporting(false);
      setReplaceTrigger(null);
    }
    setScreen(next);
  }

  const [removalId, setRemovalId] = useState<string | null>(null);
  const [lyricAction, setLyricAction] = useState(false);
  const [newLyric, setNewLyric] = useState("");
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState(false);
  const importDisabled = importLocked || importing || editingStructure;
  const [allowDraft, setAllowDraft] = useState(false);
  const [dialog, setDialog] = useState<"split" | "merge" | null>(null);
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
  const replaceProject = () => {
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
  };
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

  function openDialog(kind: "split" | "merge") {
    dialogReturnFocus.current = document.activeElement as HTMLElement | null;
    if (!selected) return;

    setDialog(kind);
  }

  function selectItem(selection: Partial<Omit<Snapshot, "project">>) {
    setHistory((h) =>
      h ? { ...h, present: { ...h.present, ...selection } } : h,
    );
  }
  function openWorkspace(name: string) {
    navigate(name);
    setRepeatOpen(false);
    setError("");
    setDialog(null);
  }

  const pendingImportSplits =
    project?.timingRun?.candidates.some(needsImportSplit);

  return (
    <div className="app">
      <main>
        <WorkbenchHeader
          screen={screen}
          project={project}
          importProgress={importProgress}
          suggestionProgress={suggestionProgress}
          translationProgress={translationProgress}
          timingProgress={timingProgress}
          saved={saved}
          openWorkspace={openWorkspace}
          importing={importing}
          editingStructure={editingStructure}
          editorHistory={editorHistory}
          history={history}
          setHistory={setHistory}
          setDialog={setDialog}
          download={download}
        />
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
          <ImportWorkspace
            project={project}
            screen={screen}
            pendingImportSplits={pendingImportSplits}
            projectAudio={projectAudio}
            splitAudio={splitAudio}
            change={change}
            replaceTrigger={replaceTrigger}
            download={download}
            setReplaceTrigger={setReplaceTrigger}
            lyricsInput={lyricsInput}
            importDisabled={importDisabled}
            setEditorHistory={setEditorHistory}
            projectSession={projectSession}
            documentSource={documentSource}
            importLocked={importLocked}
            setSuggestionProgress={setSuggestionProgress}
            setImportProgress={setImportProgress}
            runImport={runImport}
            read={read}
            snapshot={snapshot}
            navigate={navigate}
            replaceProject={replaceProject}
          />
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
                    <PhraseList
                      project={project}
                      query={query}
                      setQuery={setQuery}
                      phrase={phrase}
                      selectPhrase={selectPhrase}
                    />
                    {phrase && (
                      <>
                        <PhraseEditor
                          preview={preview}
                          phrase={phrase}
                          editPhrase={editPhrase}
                          project={project}
                          reviewActions={reviewActions}
                          proposedWords={proposedWords}
                          editingStructure={editingStructure}
                          restoreDetectedReadings={restoreDetectedReadings}
                          selected={selected}
                          openDialog={openDialog}
                          next={next}
                          index={index}
                          words={words}
                          inspectorWord={inspectorWord}
                          onSelectWord={(tokenId) => selectItem({ tokenId })}
                          updateWord={updateWord}
                          snapshot={snapshot}
                          selectedReading={selectedReading}
                          reviewIssues={reviewIssues}
                          act={act}
                        />
                        <PhraseInspector
                          inspectorWord={inspectorWord}
                          proposedWords={proposedWords}
                          updateWord={updateWord}
                          preview={preview}
                          phrase={phrase}
                          words={words}
                          setDictionaryTerm={setDictionaryTerm}
                          project={project}
                          onOpenTiming={(occurrenceId) => {
                            selectItem({ occurrenceId });
                            setScreen("Timing");
                            setError("");
                            setDialog(null);
                          }}
                          setRemovalId={setRemovalId}
                        />
                      </>
                    )}
                  </div>
                );
              }}
            </TranslateLyrics>
          )}
          {screen === "Export data" && project && (
            <ExportWorkspace
              project={project}
              videoFiles={videoFiles}
              projectAudio={projectAudio}
              change={change}
              setVideoTab={setVideoTab}
              navigate={navigate}
              download={download}
              allowDraft={allowDraft}
              setAllowDraft={setAllowDraft}
              act={act}
            />
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
                onSelect={(occurrenceId) => selectItem({ occurrenceId })}
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
          {dialog && project && phrase && selected && (
            <WordStructureDialog
              selected={selected}
              next={next}
              dialogReturnFocus={dialogReturnFocus}
              project={project}
              act={act}
              phrase={phrase}
              editPhrase={editPhrase}
              dialog={dialog}
              setDialog={setDialog}
            />
          )}
        </div>
      </main>
    </div>
  );
}
