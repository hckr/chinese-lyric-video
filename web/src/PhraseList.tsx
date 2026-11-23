import { Phrase, Project, phrasesInAppearanceOrder } from "./domain";
import { lyricCount, lyricLimit } from "./lyric-length";

export function PhraseList({
  project,
  query,
  setQuery,
  phrase,
  selectPhrase,
}: {
  project: Project;
  query: string;
  setQuery: (value: string) => void;
  phrase: Phrase | undefined;
  selectPhrase: (p: Phrase, tokenId?: string, occurrenceId?: string) => void;
}) {
  return (
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
                {project.occurrences.filter((o) => o.phraseId === p.id).length}{" "}
                occurrences · {p.review}
              </small>
              {project.translationWork?.drafts.some(
                (draft) => draft.phraseId === p.id,
              ) && <small> · Draft ready</small>}
              <strong>{p.lyricKey}</strong>
              <span lang="en">
                {p.translation.en || "No English translation"}
              </span>
              <span lang="pl">{p.translation.pl || "Brak tłumaczenia"}</span>
              {lyricCount(p.lyricKey) > lyricLimit && (
                <small className="warning">
                  {lyricCount(p.lyricKey)} / {lyricLimit} lyric characters
                </small>
              )}
            </button>
          ))}
      </div>
    </section>
  );
}
