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
  rawProject,
  parseProject,
  projectSchema,
  newId,
  pending,
  phraseIssues,
  linePinyin,
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
  return {
    present: {
      project,
      phraseId: project.phrases[0]?.id ?? "",
      tokenId: project.phrases[0]?.words[0]?.id ?? "",
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
  const [dictionaryTerm, setDictionaryTerm] = useState<string | null>(null);
  const dialogReturnFocus = useRef<HTMLElement | null>(null);
  const snapshot = history?.present,
    project = snapshot?.project,
    phrase = project?.phrases.find((p) => p.id === snapshot?.phraseId),
    selected = phrase?.words.find((w) => w.id === snapshot?.tokenId),
    index = phrase?.words.findIndex((w) => w.id === selected?.id) ?? -1,
    next = phrase?.words[index + 1];
  useEffect(() => {
    if (!project) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(project));
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
  const change = (p: Project, selection: Partial<Snapshot> = {}) =>
    setHistory((h) =>
      h
        ? commit(h, {
            ...h.present,
            project: projectSchema.parse(p),
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
            },
          }
        : h,
    );
  };
  const openProject = (p: Project) => {
    setHistory(initial(p));
    setDialog(null);
    setScreen("Lyric editor");
  };
  async function read(file: File) {
    act(() => {
      if (file.size > 5_000_000) throw Error("Import limit is 5 MB");
    });
    if (file.size > 5_000_000) return;
    try {
      const text = await file.text();
      const p = file.name.endsWith(".json")
        ? parseProject(text)
        : file.name.endsWith(".ts")
          ? importLegacy(text, file.name)
          : rawProject(text, title, artist);
      setError("");
      openProject(p);
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : String(e)}. Your current project has been retained.`,
      );
    }
  }
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
            Lyric Workbench<small>LOCAL EDITOR · v2.1</small>
          </span>
        </div>
        <nav aria-label="Workspaces">
          {[
            "Lyric editor",
            "Import lyrics",
            "Timing",
            "Video settings",
            "Export data",
          ].map((name) => (
            <button
              key={name}
              aria-current={screen === name ? "page" : undefined}
              onClick={() => {
                setScreen(name);
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
        <header>
          <span>{screen}</span>
          <div className="actions">
            <button
              disabled={!history?.past.length}
              onClick={() => {
                setHistory((h) => (h ? undo(h) : h));
                setDialog(null);
              }}
            >
              Undo
            </button>
            <button
              disabled={!history?.future.length}
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
                download(
                  "song.workbench.json",
                  JSON.stringify(project, null, 2),
                )
              }
            >
              Save project JSON
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
                  Traditional-to-Simplified conversion and dictionary
                  suggestions will use the existing Python backend in checkpoint
                  C. Raw text is currently retained as authored.
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
                  onClick={() =>
                    act(() => openProject(rawProject(raw, title, artist)))
                  }
                >
                  Import raw lyrics
                </button>
              </section>
            </div>
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
                    {project.phrases
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
                      <div className="hero">
                        <h2>{phrase.lyricKey}</h2>
                        <p>{linePinyin(phrase) || "Add word readings below"}</p>
                      </div>
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
                      <details className="personal-notes">
                        <summary>
                          Personal notes (optional)
                          {phrase.notes ? " · saved" : ""}
                        </summary>
                        <label>
                          Personal review notes (optional)
                          <textarea
                            placeholder="Reminders for yourself — saved in project JSON, not shown in the video or sent to AI."
                            value={phrase.notes}
                            onChange={(e) =>
                              editPhrase({
                                ...phrase,
                                review: "pending",
                                notes: e.target.value,
                              })
                            }
                          />
                        </label>
                      </details>
                      <div className="sectionhead">
                        <h2>Word breakdown</h2>
                        <small>
                          {phrase.words.length} rows ·{" "}
                          {
                            hanzi(phrase.words.map((w) => w.hanzi).join(""))
                              .length
                          }
                          /{hanzi(phrase.lyricKey).length} characters
                        </small>
                      </div>
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
                                    hanzi: "字",
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
                          Grammar note
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
                              placeholder="Grammar note"
                              onChange={(e) =>
                                updateWord(w.id, { hanzi: e.target.value })
                              }
                            />
                            <div>
                              <input
                                aria-label={`Pinyin ${i + 1}`}
                                value={w.pinyin}
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
                      <h2>Dictionary lookup</h2>
                      {selected ? (
                        <>
                          <div className="lookup-word">
                            <strong>{selected.hanzi || "Grammar note"}</strong>
                            {selected.hanzi && <span>{selected.pinyin}</span>}
                          </div>
                          {selected.hanzi && (
                            <button
                              onClick={() => setDictionaryTerm(selected.hanzi)}
                            >
                              Open Wiktionary
                            </button>
                          )}
                        </>
                      ) : (
                        <p>Focus a word field to look it up.</p>
                      )}
                      <hr />
                      <h2>Text preview</h2>
                      <div className="preview">
                        <small>LAYOUT ONLY · not a Remotion preview</small>
                        <p>{linePinyin(phrase)}</p>
                        <h3>{phrase.lyricKey}</h3>
                        <p>{phrase.translation.en}</p>
                        <p>{phrase.translation.pl}</p>
                      </div>
                      <h2>Occurrences</h2>
                      <p>
                        Translation edits apply to every occurrence below.
                        Imported timing is unchanged.
                      </p>
                      <ol>
                        {project.occurrences
                          .filter((o) => o.phraseId === phrase.id)
                          .map((o) => (
                            <li key={o.id}>
                              {o.id}
                              <br />
                              <small>
                                {o.startMs ?? "Unassigned"} →{" "}
                                {o.endMs ?? "Unassigned"} ms
                              </small>
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
                  disabled={warnings.length > 0 && !allowDraft}
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
                      JSON.stringify(project, null, 2),
                    )
                  }
                >
                  Download project JSON
                </button>
              </section>
              <section>
                <h2>Legacy song output</h2>
                <pre>{exportLegacy(project)}</pre>
              </section>
            </div>
          )}
          {screen === "Export data" && !project && (
            <section>Import a song first.</section>
          )}
          {["Timing", "Video settings"].includes(screen) && (
            <section>
              <h2>
                {screen === "Timing"
                  ? "Timing is checkpoint B"
                  : "Video presets and real preview are later checkpoints"}
              </h2>
              <p>
                The file editor preserves imported timestamps. This checkpoint
                does not simulate media playback or rendered video.
              </p>
              {project && screen === "Timing" && (
                <table>
                  <thead>
                    <tr>
                      <th>Occurrence</th>
                      <th>Phrase</th>
                      <th>Start ms</th>
                      <th>End ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.occurrences.map((o) => (
                      <tr key={o.id}>
                        <td>{o.id}</td>
                        <td>
                          {
                            project.phrases.find((p) => p.id === o.phraseId)
                              ?.lyricKey
                          }
                        </td>
                        <td>{o.startMs ?? "Unassigned"}</td>
                        <td>{o.endMs ?? "Unassigned"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
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
