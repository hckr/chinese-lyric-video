const root = "https://en.wiktionary.org";
export const wiktionaryUrl = (term: string) =>
  `${root}/wiki/${encodeURIComponent(term)}#Chinese`;
// Follow only a unique Chinese soft redirect. Multiple etymologies/targets must
// remain on the original page so we do not choose a different sense silently.
export function chineseRedirect(source: string): string | null {
  const chinese = source
    .split(/^==\s*Chinese\s*==\s*$/m)[1]
    ?.split(/^==[^=].*?==\s*$/m)[0];
  if (!chinese) return null;
  const targets = [
    ...new Set(
      [
        ...chinese
          .replace(/<!--[\s\S]*?-->/g, "")
          .matchAll(/\{\{zh-see\s*\|\s*(?:1\s*=\s*)?([^|{}\n]+)[|}]/gi),
      ].map((m) => m[1].trim()),
    ),
  ];
  return targets.length === 1 && /^[\p{Script=Han}]+$/u.test(targets[0])
    ? targets[0]
    : null;
}
const cache = new Map<string, string>();
export async function resolveWiktionary(
  term: string,
  request: typeof fetch = fetch,
): Promise<string> {
  if (cache.has(term)) return cache.get(term)!;
  let current = term;
  const seen = new Set<string>();
  try {
    for (let hop = 0; hop < 3; hop++) {
      if (seen.has(current)) return wiktionaryUrl(term);
      seen.add(current);
      const query = new URLSearchParams({
        action: "parse",
        page: current,
        prop: "wikitext",
        format: "json",
        formatversion: "2",
        origin: "*",
        redirects: "1",
      });
      const response = await request(`${root}/w/api.php?${query}`, {
        credentials: "omit",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return wiktionaryUrl(term);
      const data = await response.json();
      if (typeof data.parse?.wikitext !== "string") return wiktionaryUrl(term);
      const next = chineseRedirect(data.parse.wikitext);
      if (!next) {
        const url = wiktionaryUrl(current);
        cache.set(term, url);
        return url;
      }
      current = next;
    }
  } catch {
    /* Offline/CORS/API failures leave the normal dictionary link usable. */
  }
  return wiktionaryUrl(term);
}
