import { version } from "../../package.json";
import { RepeatLyricDialog } from "./RepeatLyricDialog";
import { orderGroupedProject } from "./lyric-groups.ts";
import { DictionaryLookup } from "./DictionaryLookup";
import { RemoveAppearanceDialog } from "./RemoveAppearanceDialog";
import { draftDetectedWords, draftRawLyrics } from "./raw-import";
import { TimingEditor } from "./TimingEditor";
import {
  attachAudioMetadata,
  withTimingBaseline,
  formatTime,
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
  project = withTimingBaseline(
    project.timingRun ? project : orderGroupedProject(project),
  );
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
  const [raw, setRaw] = useState(""),
    [title, setTitle] = useState(""),
    [artist, setArtist] = useState(""),
    [allowDraft, setAllowDraft] = useState(false);
  const [dialog, setDialog] = useState<"split" | "merge" | null>(null),
    [boundary, setBoundary] = useState(1),
    [leftPy, setLeftPy] = useState(""),
    [rightPy, setRightPy] = useState(""),
    [leftGloss, setLeftGloss] = useState(""),
    [rightGloss, setRightGloss] = useState("");
  const [projectSession, setProjectSession] = useState(0);
  const [dictionaryTerm, setDictionaryTerm] = useState<string | null>(null);
  const dialogReturnFocus = useRef<HTMLElement | null>(null);
  const snapshot = history?.present,
    project = snapshot?.project,
    phrase = project?.phrases.find((p) => p.id === snapshot?.phraseId),
    selected = phrase?.words.find((w) => w.id === snapshot?.tokenId),
    index = phrase?.words.findIndex((w) => w.id === selected?.id) ?? -1,
    next = phrase?.words[index + 1];
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
      setSaved("Saved in this browser · download JSON for a portable copy");
    } catch {
      setSaved("Browser storage unavailable — download project JSON to save");
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
    if (phrase && updated.words !== phrase.words)
      updated = {
        ...updated,
        lyricKey:
          updated.words.map((word) => word.hanzi).join("") || phrase.lyricKey,
      };
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
    if (phrase)
      editPhrase({
        ...pending(phrase),
        words: phrase.words.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      });
  };
  const selectPhrase = (p: Phrase) => {
    setDialog(null);
    setHistory((h) =>
      h
        ? {
            ...h,
            present: {
              ...h.present,
              phraseId: p.id,
              tokenId: p.words[0]?.id ?? "",
              occurrenceId: project?.occurrences.find(
                (cue) => cue.phraseId === p.id,
              )?.id,
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
    setHistory(initial(p));
    setDialog(null);
    setScreen("Lyric editor");
  };
  async function read(file: File) {
    act(() => {
      if (file.size > 5_000_000) throw Error("Import limit is 5 MB");
    });
    if (file.size > 5_000_000) return;
    const before = projectRef.current;
    setImporting(true);
    try {
      const text = await file.text();
      const p = file.name.endsWith(".json")
        ? parseProject(text)
        : file.name.endsWith(".ts")
          ? importLegacy(text, file.name)
          : await draftRawLyrics(text, title, artist);
      if (projectRef.current !== before)
        throw Error(
          "The open project changed during import. Import again when you are ready.",
        );
      setError("");
      openProject(p);
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : String(e)}. Your current project has been retained.`,
      );
    } finally {
      setImporting(false);
    }
  }
  async function importRaw() {
    if (importing) return;
    const before = projectRef.current;
    setImporting(true);
    setError("");
    try {
      const draft = await draftRawLyrics(raw, title, artist);
      if (projectRef.current !== before)
        throw Error(
          "The open project changed during import. Import again when ready.",
        );
      openProject(draft);
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : String(e)}. Your current project has been retained.`,
      );
    } finally {
      setImporting(false);
    }
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
  const warnings = project ? exportIssues(project) : [];
  return (
    <div className="app">
      <aside className="navigation">
        <div className="brand">
          字{" "}
          <span>
            Lyric Workbench<small>v{version}</small>
          </span>
        </div>
        <nav aria-label="Workspaces">
          {[
            "Import lyrics",
            "Lyric editor",
            "Timing",
            "Video settings",
            "Export data",
          ].map((name) => (
            <button
              key={name}
              aria-current={screen === name ? "page" : undefined}
              onClick={() => {
                setScreen(name);
                setRepeatOpen(false);
                setError("");
                setDialog(null);
              }}
            >
              {name}
            </button>
          ))}
        </nav>
        <div className="navfoot">
          {project ? (
            <>
              <strong>{project.metadata.title || "Untitled song"}</strong>
              <p>
                {project.phrases.length} unique phrases
                <br />
                {project.occurrences.length} occurrences
              </p>
            </>
          ) : (
            <p>Import a song to begin.</p>
          )}
          <small>Files stay local. No automatic AI requests.</small>
        </div>
      </aside>
      <main>
        <header ref={headerRef}>
          <span>{screen}</span>
          <div className="actions">
            <button
              disabled={editingStructure || !history?.past.length}
              onClick={() => {
                setHistory((h) => (h ? undo(h) : h));
                setDialog(null);
              }}
            >
              Undo
            </button>
            <button
              disabled={editingStructure || !history?.future.length}
              onClick={() => {
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
        <div className="content">
          <h1>{screen === "Lyric editor" ? "Translate & review" : screen}</h1>
          <p className="muted" role="status">
            {saved ||
              "Import raw lyrics, a legacy song module, or a saved workbench project."}
          </p>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {screen === "Import lyrics" && (
            <div className="two">
              <section>
                <h2>Open an existing song</h2>
                <p>
                  Import .ts data safely without running code. JSON restores
                  reviews and token identities. A successful import replaces the
                  open project; save it first if needed.
                </p>
                <label className="file">
                  Choose .ts, .txt or project .json
                  <input
                    type="file"
                    accept=".ts,.txt,.json"
                    disabled={importing || editingStructure}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void read(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <h2>Song metadata for raw lyrics</h2>
                <label>
                  Title
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  Artist
                  <input
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                  />
                </label>
                <p>
                  Legacy imports retain all metadata, translations, repetitions
                  and exact timestamps. Manual Pinyin is preserved, including
                  spacing warnings.
                </p>
                <p>
                  Raw import uses local Python, OpenCC, Jieba and CC-CEDICT to
                  create editable word drafts. Dictionary readings and glosses
                  need review; ambiguous or unknown readings stay blank.
                  Sentence translations are not generated.
                </p>
              </section>
              <section>
                <h2>Paste raw Chinese lyrics</h2>
                <label>
                  Lyrics
                  <textarea
                    className="raw"
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    placeholder={"[Verse]\n我喜欢你\n漂亮的梦\n我喜欢你"}
                  />
                </label>
                <p>
                  Section headings are removed. Punctuation splits phrases;
                  repeated lines share one translation. Timing is unassigned.
                </p>
                <button
                  className="primary"
                  disabled={importing || editingStructure}
                  onClick={() => void importRaw()}
                >
                  {importing ? "Preparing word drafts…" : "Import raw lyrics"}
                </button>
              </section>
            </div>
          )}
          {project && ["Lyric editor", "Timing"].includes(screen) && (
            <div className="lyric-structure-actions">
              {screen === "Timing" ? (
                <button
                  disabled={editingStructure || !project.phrases.length}
                  aria-haspopup="dialog"
                  onClick={() => setRepeatOpen(true)}
                >
                  Repeat
                </button>
              ) : (
                <button
                  aria-expanded={lyricAction}
                  aria-controls="lyric-structure-panel"
                  disabled={editingStructure}
                  onClick={() => setLyricAction(!lyricAction)}
                >
                  Add lyric
                </button>
              )}
              {project.source === "raw-dictionary-draft" && (
                <span className="muted">
                  Dictionary word drafts · review readings and meanings;
                  English/Polish sentences are still empty.
                </span>
              )}
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
          {screen === "Lyric editor" &&
            (!project ? (
              <section>Import a song first.</section>
            ) : (
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
                          <strong>{p.lyricKey}</strong>
                          <span lang="en">
                            {p.translation.en || "No English translation"}
                          </span>
                          <span lang="pl">
                            {p.translation.pl || "Brak tłumaczenia"}
                          </span>
                          {[...hanzi(p.lyricKey)].length > 11 && (
                            <small className="warning">
                              Long phrase · consider a manual phrase split later
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
                        <label>
                          English
                          <input
                            aria-label="English sentence"
                            value={phrase.translation.en}
                            onChange={(e) =>
                              editPhrase({
                                ...phrase,
                                review: "pending",
                                translation: {
                                  ...phrase.translation,
                                  en: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                        <label>
                          Polish
                          <input
                            aria-label="Polish sentence"
                            value={phrase.translation.pl}
                            onChange={(e) =>
                              editPhrase({
                                ...phrase,
                                review: "pending",
                                translation: {
                                  ...phrase.translation,
                                  pl: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
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
                      <h2>Word breakdown</h2>
                      {phrase.words.length === 0 &&
                        hanzi(phrase.lyricKey) &&
                        project.occurrences.some(
                          (cue) =>
                            cue.phraseId === phrase.id && cue.detectedFromAudio,
                        ) && (
                          <button
                            disabled={editingStructure}
                            onClick={() => void restoreDetectedReadings()}
                          >
                            Draft words and Pinyin
                          </button>
                        )}

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
                            editPhrase(
                              {
                                ...pending(phrase),
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
                      <div className="tokens">
                        <div className="token headings">
                          <span aria-hidden="true"></span>
                          <span>Hanzi</span>
                          <span>Pinyin</span>
                          <span>English gloss</span>
                          <span>Move</span>
                        </div>
                        {phrase.words.map((w, i) => (
                          <div
                            className={`token ${selected?.id === w.id ? "selected" : ""}`}
                            key={w.id}
                            onFocusCapture={() =>
                              setHistory((h) =>
                                h
                                  ? {
                                      ...h,
                                      present: { ...h.present, tokenId: w.id },
                                    }
                                  : h,
                              )
                            }
                          >
                            <span className="word-index" aria-hidden="true">
                              {i + 1}
                            </span>
                            <input
                              aria-label={`Hanzi ${i + 1}`}
                              value={w.hanzi}
                              placeholder="Hanzi"
                              onChange={(e) =>
                                updateWord(w.id, { hanzi: e.target.value })
                              }
                            />
                            <div>
                              <input
                                aria-label={`Pinyin ${i + 1}`}
                                value={w.pinyin}
                                placeholder={
                                  w.hanzi ? "Reading needs review" : ""
                                }
                                onChange={(e) =>
                                  updateWord(w.id, { pinyin: e.target.value })
                                }
                              />
                              {w.hanzi && /\s/u.test(w.pinyin) && (
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
                            <GlossInput
                              aria-label={`Gloss ${i + 1}`}
                              value={w.translation.en}
                              onChange={(e) =>
                                updateWord(w.id, {
                                  translation: { en: e.target.value },
                                })
                              }
                            />
                            <div className="move">
                              {[-1, 1].map((d) => (
                                <button
                                  key={d}
                                  aria-label={`${d < 0 ? "Move up" : "Move down"} word ${i + 1}`}
                                  disabled={!phrase.words[i + d]}
                                  onClick={() => {
                                    const words = [...phrase.words];
                                    [words[i], words[i + d]] = [
                                      words[i + d],
                                      words[i],
                                    ];
                                    editPhrase({ ...pending(phrase), words });
                                  }}
                                >
                                  {d < 0 ? "↑" : "↓"}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      {phraseIssues(phrase).length > 0 && (
                        <details className="review-warnings">
                          <summary className="warning">
                            {phraseIssues(phrase).length} review warnings
                          </summary>
                          <ul>
                            {phraseIssues(phrase).map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                      <button
                        className="primary"
                        onClick={() =>
                          act(() => {
                            const issues = phraseIssues(phrase);
                            if (issues.length) throw Error(issues.join("; "));
                            editPhrase({
                              ...phrase,
                              review: "reviewed",
                              segmentationApproved: true,
                            });
                          })
                        }
                      >
                        Mark phrase reviewed
                      </button>
                    </section>
                    <section className="inspector">
                      <DictionaryLookup
                        word={selected}
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
                                      {o.startMs === null && o.endMs === null
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
            ))}
          {screen === "Export data" && project && (
            <div className="two">
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
                key={projectSession}
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
                      {
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
                onReview={(id) => {
                  const target = project.phrases.find((p) => p.id === id);
                  if (target) {
                    selectPhrase(target);
                    setHistory((h) =>
                      h
                        ? {
                            ...h,
                            present: {
                              ...h.present,
                              occurrenceId: snapshot?.occurrenceId,
                            },
                          }
                        : h,
                    );
                  }
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
          {screen === "Video settings" && (
            <section>
              <h2>Video presets and real preview are later checkpoints</h2>
              <p>
                Use the existing Remotion workflow to preview and render
                exported songs.
              </p>
            </section>
          )}
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
