import {
  hanzi,
  newId,
  validatePinyinWords,
  type Phrase,
  type Project,
  type Word,
} from "./domain.ts";
import { alignedReadings } from "./split-suggestions.ts";
import {
  defaultTranslation,
  type Draft,
  type DraftValue,
  type DraftWord,
  type Stage,
} from "./translation-schema.ts";

export const stageLabels: Record<Stage, string> = {
  vocabulary: "Vocabulary and Pinyin",
  en: "English",
  pl: "Polish",
};

export const translationState = (project: Project) =>
  project.translationWork ?? defaultTranslation;

export const wordsWithoutIds = (words: Word[]): DraftWord[] =>
  words.map(({ hanzi, pinyin, translation }) => ({
    hanzi,
    pinyin,
    translation,
  }));

export function content(phrase: Phrase, stage: Stage): string | DraftWord[] {
  return stage === "vocabulary"
    ? wordsWithoutIds(phrase.words)
    : phrase.translation[stage];
}

export function fingerprint(value: DraftValue): string {
  return JSON.stringify(
    Array.isArray(value)
      ? value.map(({ hanzi, pinyin, translation }) => [
          hanzi,
          pinyin,
          translation.en,
        ])
      : value,
  );
}

export function draftIssues(
  phrase: Phrase,
  stage: Stage,
  value: DraftValue,
  wordIndex?: number,
) {
  if (
    stage !== "vocabulary" &&
    typeof value === "string" &&
    /\([^()]*:[^()]*;[^()]*:[^()]*\)|\[[^\]]*[āǎēěīǐōǒūǔǖǘǚǜ][^\]]*\]/iu.test(
      value,
    )
  )
    return [
      "Remove the pronunciation or glossary from the sentence translation.",
    ];
  if (stage !== "vocabulary")
    return typeof value === "string" && value.trim()
      ? []
      : ["Enter a sentence translation."];
  if (!Array.isArray(value) || !value.length)
    return ["Enter at least one vocabulary row."];
  const words = value.map((word, i) => ({ ...word, id: String(i) }));
  const issues = validatePinyinWords({ ...phrase, words });
  if (wordIndex !== undefined) {
    if (words.length !== 1 || words[0].hanzi !== phrase.words[wordIndex]?.hanzi)
      issues.push("The revised word must keep its Hanzi and boundaries.");
    return issues;
  }
  if (
    words.some((word) => word.hanzi !== hanzi(word.hanzi)) ||
    words.map((word) => word.hanzi).join("") !== hanzi(phrase.lyricKey)
  )
    issues.push("Vocabulary must cover the Chinese lyric in order.");
  return issues;
}

export function alignmentWarnings(value: DraftValue) {
  return typeof value === "string"
    ? []
    : value.flatMap((word, i) =>
        word.hanzi &&
        /\s/u.test(word.pinyin.trim()) &&
        !alignedReadings({ ...word, id: String(i) })
          ? [`Check how the reading aligns with ${word.hanzi}.`]
          : [],
      );
}

export function matchesBase(phrase: Phrase | undefined, draft: Draft) {
  return (
    !!phrase &&
    phrase.lyricKey === draft.source &&
    fingerprint(content(phrase, draft.stage)) === draft.base
  );
}

export function resultingVocabulary(
  phrase: Phrase,
  draft?: Draft,
): DraftWord[] {
  const current = wordsWithoutIds(phrase.words);
  if (!draft || !Array.isArray(draft.value)) return current;
  if (draft.wordIndex === undefined) return draft.value;
  const [word] = draft.value;
  return current.map((original, index) =>
    index === draft.wordIndex ? word : original,
  );
}

export function draftProblems(phrase: Phrase, draft: Draft) {
  const issues = draftIssues(phrase, draft.stage, draft.value, draft.wordIndex);
  if (
    (draft.mode === "fill" || draft.glossesOnly) &&
    Array.isArray(draft.value) &&
    phrase.words.length
  ) {
    const proposed = draft.value;
    if (
      proposed.length !== phrase.words.length ||
      phrase.words.some((word, index) => {
        const next = proposed[index];
        return (
          next.hanzi !== word.hanzi ||
          (word.pinyin.trim() && next.pinyin !== word.pinyin) ||
          (!draft.glossesOnly &&
            word.translation.en.trim() &&
            next.translation.en !== word.translation.en)
        );
      })
    )
      issues.push(
        "This draft changes existing vocabulary. Generate a replacement draft to change those fields.",
      );
  }
  return issues;
}

export function canApplyDraft(
  phrase: Phrase,
  draft: Draft,
  vocabulary?: Draft,
) {
  return (
    matchesBase(phrase, draft) &&
    !draftProblems(phrase, draft).length &&
    (draft.stage === "vocabulary" ||
      draft.support === fingerprint(resultingVocabulary(phrase, vocabulary)))
  );
}

export function applyDrafts(
  project: Project,
  ids: string[],
  bulk: boolean,
): Project {
  const work = translationState(project);
  const selected = new Set(ids);
  let accepted = { ...work.accepted };
  const applied = new Set<string>();
  const phrases = project.phrases.map((phrase) => {
    const inputs = work.drafts.filter(
      (draft) =>
        draft.phraseId === phrase.id &&
        selected.has(draft.id) &&
        (!bulk || draft.mode === "fill"),
    );
    const eligible = inputs.filter(
      (draft) =>
        matchesBase(phrase, draft) && !draftProblems(phrase, draft).length,
    );
    const proposed = eligible.find(
      (draft) => draft.stage === "vocabulary" && Array.isArray(draft.value),
    );
    let next = phrase;
    for (const draft of eligible) {
      if (!canApplyDraft(phrase, draft, proposed)) continue;
      if (draft.wordIndex !== undefined && Array.isArray(draft.value)) {
        const [word] = draft.value;
        const words = next.words.map((original, index) =>
          index === draft.wordIndex
            ? {
                ...original,
                pinyin: word.pinyin,
                translation: word.translation,
              }
            : original,
        );
        next = { ...next, words, review: "pending" };
      } else if (Array.isArray(draft.value)) {
        // Match existing rows by source position. Repeated words keep their own IDs.
        let offset = 0;
        const original = new Map<string, string[]>();
        for (const { id, hanzi } of next.words) {
          const key = JSON.stringify([offset, hanzi]);
          original.set(key, [...(original.get(key) ?? []), id]);
          offset += [...hanzi].length;
        }
        offset = 0;
        const words = draft.value.map((word) => {
          const key = JSON.stringify([offset, word.hanzi]);
          offset += [...word.hanzi].length;
          return {
            ...word,
            id: original.get(key)?.shift() ?? newId(),
          };
        });
        next = {
          ...next,
          words,
          review: "pending",
          segmentationApproved:
            next.segmentationApproved &&
            words.length === next.words.length &&
            words.every(
              (word, index) => word.hanzi === next.words[index].hanzi,
            ),
        };
      } else if (draft.stage !== "vocabulary") {
        next = {
          ...next,
          translation: { ...next.translation, [draft.stage]: draft.value },
          review: "pending",
        };
      }
      accepted = {
        ...accepted,
        [phrase.id]: {
          ...accepted[phrase.id],
          [draft.stage]: draft.provenance,
        },
      };
      applied.add(draft.id);
    }
    return next;
  });
  return applied.size
    ? {
        ...project,
        phrases,
        translationWork: {
          ...work,
          accepted,
          drafts: work.drafts.filter((draft) => !applied.has(draft.id)),
        },
      }
    : project;
}
