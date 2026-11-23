import { useEffect, useRef } from "react";
import type { DraftPreview } from "./TranslateLyrics";
import {
  Phrase,
  Project,
  Snapshot,
  Word,
  hanzi,
  newId,
  pending,
  phraseIssues,
} from "./domain";
import { wordSpans } from "./word-spans";
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
export function PhraseEditor({
  preview,
  phrase,
  editPhrase,
  project,
  reviewActions,
  proposedWords,
  editingStructure,
  restoreDetectedReadings,
  selected,
  openDialog,
  next,
  index,
  words,
  inspectorWord,
  onSelectWord,
  updateWord,
  snapshot,
  selectedReading,
  reviewIssues,
  act,
}: {
  preview: DraftPreview;
  phrase: Phrase;
  editPhrase: (p: Phrase, id?: string) => void;
  project: Project;
  reviewActions: React.ReactNode;
  proposedWords: DraftPreview["vocabulary"];
  editingStructure: boolean;
  restoreDetectedReadings: () => void;
  selected: Word | undefined;
  openDialog: (kind: "split" | "merge") => void;
  next: Word | undefined;
  index: number;
  words: Word[];
  inspectorWord: Word;
  onSelectWord: (id: string) => void;
  updateWord: (id: string, patch: Partial<Word>) => void;
  snapshot: Snapshot | undefined;
  selectedReading: React.RefObject<HTMLInputElement | null>;
  reviewIssues: string[];
  act: (fn: () => void) => void;
}) {
  return (
    <section className="editor">
      <div className="two sentence-fields">
        {(["en", "pl"] as const).map((language) => {
          const draft = preview.sentences[language];
          const label = language === "en" ? "English" : "Polish";
          return (
            <div key={language}>
              <label>
                {label}
                {draft && " · Draft"}
                <input
                  aria-label={`${label} sentence`}
                  className={draft && "draft-field"}
                  readOnly={draft?.readOnly}
                  value={draft?.value ?? phrase.translation[language]}
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
                {draft?.previous && draft.previous !== draft.value && (
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
        (other) => other.id !== phrase.id && other.lyricKey === phrase.lyricKey,
      ) && (
        <p role="status" className="warning">
          Duplicate lyric text. Keep translations and word breakdowns consistent
          before TypeScript export.
        </p>
      )}
      {reviewActions}
      <h2>Word breakdown {proposedWords && <small>· Draft</small>}</h2>
      {preview.actions.vocabulary}
      {proposedWords?.previousBoundaries && (
        <p className="draft-previous">
          Previous word boundaries · {proposedWords.previousBoundaries}
        </p>
      )}
      {!proposedWords &&
        phrase.words.length === 0 &&
        hanzi(phrase.lyricKey) &&
        project.occurrences.some(
          (cue) => cue.phraseId === phrase.id && cue.detectedFromAudio,
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
              const span = wordSpans(phrase.lyricKey, phrase.words).find(
                ({ word }) => word.id === selected?.id,
              );
              const lyricKey = span
                ? phrase.lyricKey.slice(0, span.start) +
                    phrase.lyricKey.slice(span.end) || phrase.lyricKey
                : phrase.lyricKey;
              editPhrase(
                {
                  ...pending(phrase),
                  lyricKey,
                  words: phrase.words.filter((w) => w.id !== selected?.id),
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
              onFocusCapture={() => onSelectWord(w.id)}
            >
              <span className="word-index" aria-hidden="true">
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
                  ref={w.id === snapshot?.tokenId ? selectedReading : undefined}
                  className={
                    reading && reading.value !== reading.previous
                      ? "draft-field"
                      : undefined
                  }
                  readOnly={
                    proposedWords ? (reading?.readOnly ?? true) : undefined
                  }
                  value={w.pinyin}
                  placeholder={w.hanzi ? "Reading needs review" : ""}
                  onChange={(e) =>
                    reading
                      ? reading.edit(e.target.value)
                      : updateWord(w.id, {
                          pinyin: e.target.value,
                        })
                  }
                />
                {reading?.previous && reading.previous !== reading.value && (
                  <small className="draft-previous">
                    Previous · {reading.previous}
                  </small>
                )}
              </div>
              <div>
                <GlossInput
                  aria-label={`Gloss ${i + 1}`}
                  data-draft={
                    gloss && gloss.value !== gloss.previous ? true : undefined
                  }
                  readOnly={
                    proposedWords ? (gloss?.readOnly ?? true) : undefined
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
                {gloss?.previous && gloss.previous !== gloss.value && (
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
                    disabled={!!proposedWords || !phrase.words[i + d]}
                    onClick={() => {
                      const words = [...phrase.words];
                      [words[i], words[i + d]] = [words[i + d], words[i]];
                      const ids = new Set([w.id, phrase.words[i + d].id]);
                      const [left, right] = wordSpans(
                        phrase.lyricKey,
                        phrase.words,
                      ).filter(({ word }) => ids.has(word.id));
                      const lyricKey =
                        left && right
                          ? phrase.lyricKey.slice(0, left.start) +
                            right.word.hanzi +
                            phrase.lyricKey.slice(left.end, right.start) +
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
              {inspectorWord?.id === w.id && preview.wordAction?.(i)}
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
        className={phrase.review === "reviewed" ? undefined : "primary"}
        disabled={
          phrase.review !== "reviewed" &&
          (!!proposedWords || Object.keys(preview.sentences).length > 0)
        }
        onClick={() =>
          act(() => {
            if (phrase.review === "reviewed") {
              editPhrase({ ...phrase, review: "pending" });
              return;
            }
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
        {phrase.review === "reviewed"
          ? "Mark as needing review"
          : "Mark phrase reviewed"}
      </button>
    </section>
  );
}
