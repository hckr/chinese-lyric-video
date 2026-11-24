import { parseLrc } from "./edition-cues.ts";
import { z } from "zod";

export const recordingSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  url: z.string().url(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  fetchedAt: z.string().datetime(),
  title: z.string(),
  channel: z.string().optional(),
  channel_url: z.string().optional(),
  artist: z.string().optional(),
  track: z.string().optional(),
  album: z.string().optional(),
  duration: z.number().optional(),
  upload_date: z.string().optional(),
  license: z.string().optional(),
});
export type Recording = z.infer<typeof recordingSchema>;
export const lyricCreditSchema = z.object({
  provider: z.literal("LRCLIB"),
  id: z.number().int(),
  url: z.string().url(),
  track: z.string(),
  artist: z.string(),
  album: z.string(),
  duration: z.number(),
  fetchedAt: z.string().datetime(),
});
export type LyricCredit = z.infer<typeof lyricCreditSchema>;
export async function acquireRecording(url: string, signal?: AbortSignal) {
  const r = await fetch("/api/youtube", {
    signal,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Could not fetch song.");
  return recordingSchema.parse(data);
}
export async function cachedRecording(source: Recording) {
  const response = await fetch("/api/youtube/media/" + source.id);
  if (!response.ok) throw Error("Cached recording unavailable.");
  const blob = await response.blob();
  const fingerprint = await recordingFingerprint(blob);
  if (fingerprint !== source.fingerprint)
    throw Error("Recording changed. Relink and verify it in Timing.");
  return new File([blob], source.id + ".mp4", {
    type: "video/mp4",
    lastModified: Date.parse(source.fetchedAt),
  });
}
const candidateSchema = z.object({
  id: z.number().int(),
  trackName: z.string(),
  artistName: z.string(),
  albumName: z.string().nullable(),
  duration: z.number(),
  plainLyrics: z.string().nullish(),
  syncedLyrics: z.string().nullish(),
  instrumental: z.boolean(),
});
export async function findLyrics(
  title: string,
  artist: string,
  duration?: number,
) {
  const query = new URLSearchParams({ track_name: title });
  if (artist) query.set("artist_name", artist);
  const r = await fetch("https://lrclib.net/api/search?" + query, {
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw Error("Lyrics search unavailable. Retry or paste lyrics.");
  const rows = candidateSchema.array().parse(await r.json());
  return rows
    .filter((row) => !row.instrumental)
    .map((row) => ({ ...row, cues: parseLrc(row.syncedLyrics ?? "") }))
    .filter((row) => row.plainLyrics?.trim() || row.cues.some((c) => c.text))
    .sort((a, b) =>
      duration
        ? Math.abs(duration - a.duration) - Math.abs(duration - b.duration)
        : 0,
    )
    .map((row) => ({
      cues: row.cues.some((c) => c.text) ? row.cues : [],
      text: row.cues.some((c) => c.text)
        ? row.cues
            .filter((c) => c.text)
            .map((c) => c.text)
            .join("\n")
        : row.plainLyrics!,
      credit: {
        provider: "LRCLIB" as const,
        id: row.id,
        url: "https://lrclib.net/api/get/" + row.id,
        track: row.trackName,
        artist: row.artistName,
        album: row.albumName ?? "",
        duration: row.duration,
        fetchedAt: new Date().toISOString(),
      },
    }));
}

const hashes = new WeakMap<Blob, Promise<string>>();
export function recordingFingerprint(blob: Blob) {
  const cached = hashes.get(blob);
  if (cached) return cached;
  const pending = hashRecording(blob).catch((error) => {
    hashes.delete(blob);
    throw error;
  });
  hashes.set(blob, pending);
  return pending;
}
async function hashRecording(blob: Blob) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
