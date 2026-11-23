import type { LyricField } from "./lyric-field.ts";
import type { VerifiedSplitAudio } from "../timing/AutomaticTiming";
import { useEffect, useRef, useState } from "react";
import type { Project } from "../domain";
import { projectDocument } from "./lyrics-document";
import {
  addReviewedPieces,
  needsImportSplit,
} from "../timing/automatic-timing";
import { draftDetectedPieces } from "./raw-import";
import { CandidateSplits } from "../timing/CandidateSplits";
import { LyricsEditor } from "./LyricsEditor";

export function ImportAudioSplits({
  project,
  file,
  verifiedAudio,
  apply,
  active,
}: {
  project: Project;
  file: File | null;
  verifiedAudio?: VerifiedSplitAudio;
  apply: (project: Project) => void;
  active: boolean;
}) {
  const pending = project.timingRun?.candidates.filter(needsImportSplit) ?? [];
  const [selected, setSelected] = useState<string>();
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editor = useRef<LyricField>(null);
  const player = useRef<HTMLAudioElement>(null);
  const stop = useRef<number | undefined>(undefined);
  const [url, setUrl] = useState("");
  const duration =
    verifiedAudio &&
    verifiedAudio.file === file &&
    verifiedAudio.runId === project.timingRun?.id
      ? verifiedAudio.duration
      : undefined;
  const current = useRef({ project, file, duration });
  current.current = { project, file, duration };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const source = URL.createObjectURL(file);
    setUrl(source);
    return () => URL.revokeObjectURL(source);
  }, [file]);
  useEffect(() => {
    if (!active) player.current?.pause();
  }, [active]);
  const candidate = pending.find((c) => c.id === selected) ?? pending[0];
  const candidateId = candidate?.id;
  useEffect(() => {
    if (active && candidateId !== undefined) setReview(false);
  }, [active, candidateId]);
  if (!candidate) return null;
  const lines = projectDocument(project);
  const after = project.occurrences.find(
    (o) => o.startMs !== null && o.startMs > candidate.startMs,
  );
  const at = after
    ? lines.findIndex((line) => line.id === after.id)
    : lines.length;
  const start = Math.max(0, at - 2);
  const preview = [
    ...lines.slice(start, at),
    { id: candidate.id, text: candidate.text },
    ...lines.slice(at, at + 2),
  ];
  return (
    <section
      aria-label="Audio passages to split"
      className="import-audio-splits"
    >
      <h2>Audio passages to split</h2>
      {pending.length > 1 && (
        <label>
          Passage{" "}
          <select
            value={candidate.id}
            disabled={busy}
            onChange={(event) => setSelected(event.target.value)}
          >
            {pending.map((c) => (
              <option key={c.id} value={c.id}>
                {c.text}
              </option>
            ))}
          </select>
        </label>
      )}
      <LyricsEditor
        key={candidate.id + (active ? "-active" : "-inactive")}
        active={active}
        lines={preview}
        editor={editor}
        change={() => {}}
        readOnly
        wordChoices={
          new Map(
            project.phrases.map((phrase) => [phrase.lyricKey, phrase.words]),
          )
        }
        initialLine={at - start}
      />
      {url && (
        <audio
          ref={player}
          src={url}
          onTimeUpdate={(event) => {
            if (
              stop.current !== undefined &&
              event.currentTarget.currentTime >= stop.current
            )
              event.currentTarget.pause();
          }}
        />
      )}
      {duration === undefined && (
        <p>
          Check or explicitly reuse the linked audio before adding these
          timings.
        </p>
      )}
      <div className="import-audio-split-actions">
        {review ? (
          <CandidateSplits
            key={candidate.id}
            candidate={candidate}
            disabled={busy}
            audioReady={duration !== undefined && !!url}
            duration={duration}
            listen={(piece) => {
              const audio = player.current;
              if (!audio) return;
              stop.current = piece.endMs / 1000;
              audio.currentTime = piece.startMs / 1000;
              void audio
                .play()
                .catch(() => setError("Could not play the linked audio."));
            }}
            cancel={() => setReview(false)}
            add={async (pieces) => {
              if (duration === undefined) return;
              setBusy(true);
              setError("");
              try {
                const words = await draftDetectedPieces(
                  pieces.map((piece) => piece.text),
                );
                if (!mounted.current) return;
                if (
                  current.current.project !== project ||
                  current.current.file !== file ||
                  current.current.duration !== duration
                )
                  throw Error("The project changed. Review the passage again.");
                apply(
                  addReviewedPieces(
                    project,
                    candidate.id,
                    pieces.map((piece, index) => ({
                      ...piece,
                      words: words[index],
                    })),
                    duration,
                  ),
                );
              } catch (reason) {
                setError(
                  reason instanceof Error ? reason.message : String(reason),
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : (
          <button
            onClick={() => {
              setError("");
              setReview(true);
            }}
          >
            Review splits
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => {
            if (project.timingRun)
              apply({
                ...project,
                timingRun: {
                  ...project.timingRun,
                  candidates: project.timingRun.candidates.filter(
                    (c) => c.id !== candidate.id,
                  ),
                },
              });
          }}
        >
          Dismiss passage
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
