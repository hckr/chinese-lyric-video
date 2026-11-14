import { parseProject, type Project } from "./domain.ts";

export async function draftRawLyrics(
  raw: string,
  title = "",
  artist = "",
): Promise<Project> {
  const response = await fetch("/api/import-lyrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw, title, artist }),
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
