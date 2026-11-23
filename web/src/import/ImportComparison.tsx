import { needsImportSplit } from "../timing/automatic-timing";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PassagePinyin } from "../translations/WordReview";
import {
  AutomaticTiming,
  type VerifiedSplitAudio,
} from "../timing/AutomaticTiming";
import { decodeWaveform } from "../timing/waveform-stream";
import { formatTime } from "../timing/timing";
import type { Project, Occurrence } from "../domain";

export function comparisonFindings(project: Project) {
  const run = project.timingRun;
  const matched: Occurrence[] = [];
  const discrepancies: { cue: Occurrence; label: "Unmatched" | "Uncertain" }[] =
    [];
  for (const cue of project.occurrences) {
    if (cue.detectedFromAudio) continue;
    const observed = cue.automaticTiming;
    if (
      !run ||
      cue.timingIssue?.runId === run.id ||
      !observed ||
      observed.runId !== run.id
    ) {
      discrepancies.push({
        cue,
        label:
          cue.weakTiming || cue.timingIssue?.matched
            ? "Uncertain"
            : "Unmatched",
      });
    } else if (
      observed.reasons.length ||
      (observed.matched ?? 0) < (observed.total ?? 0)
    ) {
      discrepancies.push({ cue, label: "Uncertain" });
    } else matched.push(cue);
  }
  const uncertain = discrepancies.filter((d) => d.label === "Uncertain").length;
  return { matched, discrepancies, uncertain };
}

export function ImportComparison({
  project,
  onSplitAudioReady,
  file,
  active,
  update,
  report,
  back,
  onStart,
  insertion,
  addedNotice,
  passageId,
}: {
  project: Project;
  onSplitAudioReady: (audio: VerifiedSplitAudio | undefined) => void;
  file: File;
  active: boolean;
  update: (p: Project) => void;
  report: (s: string) => void;
  back: () => void;
  onStart: () => void;
  insertion?: ReactNode;
  addedNotice?: ReactNode;
  passageId?: string;
}) {
  const player = useRef<HTMLAudioElement>(null),
    stop = useRef(0);
  const triggerSettings = useRef<HTMLButtonElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [waveform, setWaveform] = useState<number[]>();
  const [waveformFailed, setWaveformFailed] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [duration, setDuration] = useState<number>();
  const [ack, setAck] = useState("");
  const [progress, setProgress] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const el = player.current!;
    el.src = url;
    return () => {
      el.pause();
      URL.revokeObjectURL(url);
    };
  }, [file]);
  useEffect(() => {
    if (!active) player.current?.pause();
  }, [active]);
  const run = project.timingRun;
  const { matched, discrepancies, uncertain } = comparisonFindings(project);
  const textById = new Map(project.phrases.map((p) => [p.id, p.lyricKey]));
  const attention =
    !!run &&
    (run.candidates.length > 0 || (discrepancies.length > 0 && ack !== run.id));
  useEffect(() => {
    report(progress || (attention ? "!" : ""));
    return () => report("");
  }, [progress, attention, report]);
  const passage = run?.candidates.find(
    (candidate) => candidate.id === passageId,
  );
  const needsWaveform = !!passage;
  useEffect(() => {
    if (!needsWaveform || !duration || waveform || waveformFailed) return;
    const controller = new AbortController();
    decodeWaveform(file, duration, controller.signal).then(
      (peaks) => {
        if (!controller.signal.aborted) setWaveform(peaks);
      },
      () => {
        if (!controller.signal.aborted) setWaveformFailed(true);
      },
    );
    return () => controller.abort();
  }, [file, duration, needsWaveform, waveform, waveformFailed]);
  function listen(bounds: { startMs: number; endMs: number }) {
    const el = player.current!;
    el.currentTime = bounds.startMs / 1000;
    stop.current = bounds.endMs / 1000;
    void el.play().catch(() => {});
  }
  const bars =
    passage && duration && waveform
      ? Array.from({ length: 80 }, (_, i) => {
          const length = passage.endMs - passage.startMs;
          const first = Math.floor(
            ((passage.startMs + (i * length) / 80) * waveform.length) /
              duration,
          );
          const last = Math.ceil(
            ((passage.startMs + ((i + 1) * length) / 80) * waveform.length) /
              duration,
          );
          return Math.max(
            0,
            ...waveform.slice(first, Math.max(first + 1, last)),
          );
        })
      : undefined;
  return (
    <div className="import-comparison">
      <div className="comparison-heading">
        <h3>Compare audio with pasted lyrics</h3>
        <button onClick={back}>Back to lyrics editor</button>
        {!insertion && run?.candidates.some(needsImportSplit) && (
          <span>Review over-limit passages in the lyrics editor.</span>
        )}
      </div>
      <audio
        ref={player}
        onError={() => setMediaError(true)}
        onLoadedMetadata={() =>
          setDuration(Math.round(player.current!.duration * 1000))
        }
        onTimeUpdate={() => {
          if (player.current!.currentTime >= stop.current)
            player.current!.pause();
        }}
      />
      {mediaError && (
        <p role="alert">
          This audio file could not be played. Choose a playable file or import
          the lyrics directly.
        </p>
      )}
      {run && (
        <>
          <div className="comparison-status">
            <span>
              <strong>Transcription completed</strong> ·{" "}
              {run.provider === "groq" ? "Groq" : "Local Whisper"} · {run.model}{" "}
              · {file.name}
            </span>
            <button
              ref={triggerSettings}
              aria-expanded={settingsOpen || (!!progress && progress !== "!")}
              onClick={() => setSettingsOpen(!settingsOpen)}
            >
              Settings / Transcribe again
            </button>
          </div>
          <div className="comparison-stats">
            {[
              [matched.length, "Matched occurrences"],
              [uncertain, "Uncertain matches"],
              [discrepancies.length - uncertain, "Unmatched pasted lines"],
              [run.candidates.length, "Audio-only passages"],
            ].map(([count, label]) => (
              <div key={label}>
                <strong>{count}</strong>
                {label}
              </div>
            ))}
          </div>
        </>
      )}
      {addedNotice}
      <div className="comparison-grid" data-reviewing={!!insertion}>
        <div className="comparison-findings" hidden={!!insertion}>
          {run && <h4>Review findings</h4>}
          <AutomaticTiming
            comparison
            onComparisonStart={onStart}
            project={project}
            file={file}
            duration={duration}
            expanded={!run || settingsOpen || (!!progress && progress !== "!")}
            onCollapse={() => setSettingsOpen(false)}
            revealTiming={triggerSettings}
            onViewLyric={() => {}}
            onChange={update}
            onListen={listen}
            onSplitAudioReady={onSplitAudioReady}
            onIdentityReady={() => {}}
            report={setProgress}
            selectedCandidate={passageId}
            comparisonResults={
              run && (
                <div className="comparison-other">
                  <details name="audio-alignment-results">
                    <summary>
                      {discrepancies.length} uncertain or unmatched pasted lines
                    </summary>
                    <ul>
                      {discrepancies.map(({ cue, label }) => (
                        <li key={cue.id}>
                          {textById.get(cue.phraseId)} · {label}
                        </li>
                      ))}
                    </ul>
                    {discrepancies.length > 0 && ack !== run.id && (
                      <button onClick={() => setAck(run.id)}>
                        Acknowledge uncertain and unmatched lyrics
                      </button>
                    )}
                  </details>
                  <details name="audio-alignment-results">
                    <summary>{matched.length} matched occurrences</summary>
                    <ul>
                      {matched.map((o) => (
                        <li key={o.id}>{textById.get(o.phraseId)}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              )
            }
          />
        </div>
        {insertion && (
          <div className="comparison-inspector">
            <h4>Review insertion</h4>
            {passage && (
              <>
                <p className="comparison-passage">{passage.text}</p>
                <PassagePinyin
                  key={passage.id}
                  id={passage.id}
                  text={passage.text}
                />
                {bars ? (
                  <div
                    className="passage-waveform"
                    role="img"
                    aria-label="Waveform of detected passage"
                  >
                    {bars.map((peak, i) => (
                      <i
                        key={i}
                        style={{ height: Math.max(4, peak * 100) + "%" }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    {waveformFailed
                      ? "Waveform unavailable"
                      : "Preparing waveform…"}
                  </p>
                )}
                <div className="passage-playback">
                  <button
                    disabled={mediaError || !duration}
                    onClick={() => listen(passage)}
                  >
                    Listen to passage
                  </button>
                  <span>
                    {formatTime(passage.startMs)}–{formatTime(passage.endMs)}
                  </span>
                </div>
              </>
            )}
            {insertion}
          </div>
        )}
      </div>
    </div>
  );
}
