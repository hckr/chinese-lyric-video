import { z } from "zod";
const entrySchema = z
  .object({
    hanzi: z.string(),
    pinyin: z.string(),
    meanings: z.array(z.string()),
  })
  .strict();
export type DictionaryEntry = z.infer<typeof entrySchema>;
const cache = new Map<string, Promise<DictionaryEntry[]>>();

export function lookupDictionary(term: string): Promise<DictionaryEntry[]> {
  const cached = cache.get(term);
  if (cached) return cached;
  const request = (async () => {
    const response = await fetch("/api/dictionary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term }),
      signal: AbortSignal.timeout(35000),
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw Error(
        "Dictionary service unavailable. Restart npm run workbench to enable on-demand lookup.",
      );
    }
    if (!response.ok)
      throw Error(
        typeof data === "object" && data && "error" in data
          ? String(data.error)
          : "Dictionary lookup failed.",
      );
    // The exact-term endpoint resolves traditional forms through OpenCC.
    return z
      .array(entrySchema)
      .parse(data)
      .map((entry) => ({ ...entry, hanzi: term }));
  })();
  cache.set(term, request);
  void request.catch(() => cache.delete(term));
  // Keep browsing sessions bounded; entries are reference data, not project edits.
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  return request;
}
