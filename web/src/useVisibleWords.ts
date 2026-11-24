import { dictionaryReadings } from "./dictionary/dictionary-readings.ts";
import type { DictionaryEntry } from "./dictionary/dictionary-service.ts";
import { useEffect, useRef, useState } from "react";
import { parseProject, type Word } from "./domain";

// Warm the document in bounded batches; scrolling does not restart the lookup.
export function useVisibleWords(texts: string[]) {
  const cache = useRef(
    new Map<string, { words: Word[]; readings: Record<string, string> }>(),
  );
  const [, refresh] = useState(0);
  const missing = JSON.stringify(
    [...new Set(texts)].filter((text) => !cache.current.has(text)).slice(0, 96),
  );
  useEffect(() => {
    const batch: string[] = JSON.parse(missing);
    if (!batch.length) return;
    const controller = new AbortController();
    async function load() {
      const response = await fetch("/api/import-lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          review: true,
          document: {
            occurrences: batch.map((text, i) => ({ id: "visible-" + i, text })),
            groups: [],
          },
        }),
      });
      if (!response.ok) return;
      const { project, terms } = await response.json();
      const readings = Object.fromEntries(
        Object.entries(terms as Record<string, DictionaryEntry[]>).map(
          ([term, entries]) => [
            term,
            dictionaryReadings(entries)[0]?.pinyin ?? "",
          ],
        ),
      );
      const parsed = parseProject(JSON.stringify(project));
      const phrases = new Map(parsed.phrases.map((p) => [p.id, p]));
      for (const o of parsed.occurrences) {
        const phrase = phrases.get(o.phraseId);
        const source = batch[Number(o.id.slice("visible-".length))];
        if (phrase && source)
          cache.current.set(source, { words: phrase.words, readings });
      }
      if (!controller.signal.aborted) refresh((n) => n + 1);
    }
    const timer = setTimeout(
      () =>
        void load().catch(() => {
          /* Dictionary decoration is optional while typing. */
        }),
      batch.length > 1 ? 0 : 180,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [missing]);
  return cache.current;
}
