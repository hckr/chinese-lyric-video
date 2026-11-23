import { useState, type RefObject } from "react";
import {
  addLyric,
  newId,
  pending,
  removeAppearance,
  repeatAppearance,
  type Phrase,
  type Project,
  type Snapshot,
} from "../domain";
import { draftDetectedWords, draftRawLyrics } from "../import/raw-import";

export function useLyricStructure({
  snapshot,
  phrase,
  timingActive,
  projectRef,
  change,
  act,
  setError,
  clearQuery,
}: {
  snapshot: Snapshot | undefined;
  phrase: Phrase | undefined;
  timingActive: boolean;
  projectRef: RefObject<Project | undefined>;
  change: (
    project: Project,
    selection: Partial<Omit<Snapshot, "project">>,
    preserveOrder?: boolean,
  ) => void;
  act: (fn: () => void) => void;
  setError: (message: string) => void;
  clearQuery: () => void;
}) {
  const project = snapshot?.project;
  const [removalId, setRemovalId] = useState<string | null>(null);
  const [lyricAction, setLyricAction] = useState(false);
  const [newLyric, setNewLyric] = useState("");
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState(false);
  const insertionAfterId = timingActive
    ? snapshot?.occurrenceId
    : (project?.occurrences.find(
        (cue) =>
          cue.id === snapshot?.occurrenceId && cue.phraseId === phrase?.id,
      )?.id ??
      project?.occurrences.find((cue) => cue.phraseId === phrase?.id)?.id);
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
      clearQuery();
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
      clearQuery();
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

  return {
    removalId,
    setRemovalId,
    lyricAction,
    setLyricAction,
    newLyric,
    setNewLyric,
    repeatOpen,
    setRepeatOpen,
    editingStructure,
    restoreDetectedReadings,
    createLyric,
    repeatLyric,
    deleteAppearance,
  };
}
