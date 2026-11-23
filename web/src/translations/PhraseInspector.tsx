import { DictionaryLookup } from "../dictionary/DictionaryLookup";
import type { DraftPreview } from "./TranslateLyrics";
import { Phrase, Project, Word } from "../domain";
import { formatTime } from "../timing/timing.ts";

export function PhraseInspector({
  inspectorWord,
  proposedWords,
  updateWord,
  preview,
  phrase,
  words,
  setDictionaryTerm,
  project,
  onOpenTiming,
  setRemovalId,
}: {
  inspectorWord: Word;
  proposedWords: DraftPreview["vocabulary"];
  updateWord: (id: string, patch: Partial<Word>) => void;
  preview: DraftPreview;
  phrase: Phrase;
  words: Word[];
  setDictionaryTerm: (value: string) => void;
  project: Project;
  onOpenTiming: (occurrenceId: string) => void;
  setRemovalId: (value: string) => void;
}) {
  return (
    <section className="inspector">
      <DictionaryLookup
        word={inspectorWord}
        onPick={
          proposedWords
            ? undefined
            : (entry) =>
                updateWord(inspectorWord.id, {
                  pinyin: entry.pinyin,
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
                  phrase.lyricKey.indexOf(w.hanzi, offset) + w.hanzi.length,
                0,
              ),
          ),
        }}
        onOpenWiktionary={setDictionaryTerm}
      />
      <hr />
      <h2>Timing</h2>
      <p>
        Edit timing for each appearance of this lyric. Translation changes apply
        to all.
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
                  onClick={() => onOpenTiming(o.id)}
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
  );
}
