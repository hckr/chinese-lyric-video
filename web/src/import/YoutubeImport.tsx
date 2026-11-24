import type { WordProvider } from "../translations/WordReview";
import { EditionComparison } from "./EditionComparison";
import type { EditionTiming, SourceCue } from "./edition-cues";
import { useEffect, useRef, useState } from "react";
import {
  acquireRecording,
  cachedRecording,
  findLyrics,
  type Recording,
  type LyricCredit,
} from "./song-source";

export function YoutubeImport({
  active,
  file,
  provider,
  title,
  artist,
  recording,
  onRecording,
  onLyrics,
}: {
  active: boolean;
  file: File | null;
  provider?: WordProvider;
  title: string;
  artist: string;
  recording?: Recording;
  onRecording: (r: Recording, f: File) => void;
  onLyrics: (
    text: string,
    c: LyricCredit,
    cues: SourceCue[],
    timing?: EditionTiming,
  ) => void;
}) {
  const [url, setUrl] = useState(""),
    [message, setMessage] = useState(""),
    [rows, setRows] = useState<Awaited<ReturnType<typeof findLyrics>>>([]);
  const [reviewed, setReviewed] = useState<number[]>([]);
  const [comparing, setComparing] = useState(false);
  const disclosure = useRef<HTMLDetailsElement>(null);
  const applyRecording = useRef(onRecording);
  applyRecording.current = onRecording;
  const controller = useRef<AbortController | undefined>(undefined);
  const visit = useRef(0);
  useEffect(
    () => () => {
      controller.current?.abort();
      visit.current++;
    },
    [],
  );
  async function lookup(
    t: string,
    a: string,
    d: number | undefined,
    n: number,
  ) {
    setReviewed([]);
    setRows([]);
    setMessage("Searching LRCLIB…");
    try {
      const results = await findLyrics(t, a, d);
      if (n === visit.current) {
        setRows(results);
        setComparing(!!results.length);
        setMessage(
          results.length
            ? ""
            : "No matching lyrics. Edit the title or artist and retry, or paste lyrics.",
        );
      }
    } catch {
      if (n === visit.current)
        setMessage("Lyrics lookup failed. Retry or paste lyrics.");
    }
  }
  async function load() {
    controller.current?.abort();
    const download = new AbortController();
    controller.current = download;
    const n = ++visit.current;
    setReviewed([]);
    setRows([]);
    setMessage("Fetching recording…");
    try {
      const source = await acquireRecording(url, download.signal);
      const file = await cachedRecording(source);
      if (n !== visit.current) return;
      applyRecording.current(source, file);
      await lookup(
        source.track || source.title,
        source.artist || "",
        source.duration,
        n,
      );
    } catch (e) {
      if (n === visit.current)
        setMessage(e instanceof Error ? e.message : "Fetch failed.");
    }
  }
  return (
    <details
      className="youtube-entry"
      ref={disclosure}
      onToggle={(e) => {
        if (!e.currentTarget.open) setComparing(false);
      }}
    >
      <summary>Import from YouTube</summary>
      <label>
        YouTube video URL
        <input
          type="url"
          value={url}
          onChange={(e) => {
            controller.current?.abort();
            visit.current++;
            setUrl(e.target.value);
            setReviewed([]);
            setRows([]);
            setMessage("");
          }}
        />
      </label>
      <button disabled={!url.trim()} onClick={() => void load()}>
        Fetch song
      </button>
      {recording && (
        <>
          <p>
            <a href={recording.url}>{recording.title}</a> · {recording.channel}
          </p>
          <button
            disabled={!title.trim()}
            onClick={() =>
              void lookup(title, artist, recording.duration, ++visit.current)
            }
          >
            Search lyrics again
          </button>
        </>
      )}
      <p role="status">{message}</p>
      {!!rows.length &&
        file &&
        recording &&
        (comparing && active ? (
          <EditionComparison
            reviewed={reviewed}
            setReviewed={setReviewed}
            fingerprint={recording.fingerprint}
            provider={provider}
            rows={rows}
            file={file}
            close={() => setComparing(false)}
            apply={(text, credit, cues, timing) => {
              onLyrics(text, credit, cues, timing);
              setComparing(false);
              if (disclosure.current) disclosure.current.open = false;
            }}
          />
        ) : (
          <button onClick={() => setComparing(true)}>
            Compare lyric editions
          </button>
        ))}
    </details>
  );
}
