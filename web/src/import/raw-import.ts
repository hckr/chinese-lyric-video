import {
  detectStructure,
  groupsOf,
  type Structure,
} from "./import-structure.ts";
import { hanzi, newId, parseProject, type Project } from "../domain.ts";

export async function draftRawLyrics(
  raw: string,
  title = "",
  artist = "",
  draft?: Structure,
  dictionaryPassages?: string[],
): Promise<Project> {
  const response = await fetch("/api/import-lyrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      raw,
      dictionaryPassages,
      title,
      artist,
      structure: draft && {
        rows: detectStructure(raw).rows,
        pieces: draft.rows.map((r) => r.text),
        groups: groupsOf(draft),
      },
    }),
    signal: AbortSignal.timeout(35000),
  });
  const text = await response.text();
  let data: { error?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw Error(
      "Local import service unavailable. Restart npm run workbench to enable Python word drafts.",
    );
  }
  if (!response.ok)
    throw Error(data.error || "Local dictionary import failed.");
  return parseProject(text);
}

/** Recover the local dictionary draft for a passage saved before drafts were retained. */
export async function draftDetectedWords(text: string) {
  return (await draftDetectedPieces([text]))[0];
}
export async function draftDetectedPieces(pieces: string[]) {
  if (!pieces.some((text) => hanzi(text))) return pieces.map(() => []);
  const draft = await draftRawLyrics("", "", "", undefined, pieces);
  const phrases = new Map(draft.phrases.map((p) => [p.id, p]));
  return pieces.map((text, i) => {
    const words = phrases.get(draft.occurrences[i]?.phraseId)?.words ?? [];
    if (hanzi(words.map((word) => word.hanzi).join("")) !== hanzi(text))
      throw Error(
        "The dictionary draft changed the lyric text. Edit its word breakdown manually.",
      );
    return words.map((word) => ({ ...word, id: newId() }));
  });
}
