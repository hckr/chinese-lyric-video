import { timingWav } from "./timing-audio.ts";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";
import {
  audioIdentitySchema,
  defaultTimingSettings,
  type Project,
} from "./domain.ts";
import {
  addDetectedCandidate,
  needsImportSplit,
  applyGeneration,
  applyEnglishRetry,
  englishRetryIds,
  formatTimingEta,
  parseWhisperTranscript,
  type GenerationPolicy,
} from "./automatic-timing.ts";
import { draftDetectedWords } from "./raw-import";
import { TimingConfirmDialog } from "./TimingConfirmDialog";
import { formatTime, timingStatus } from "./timing.ts";

export type VerifiedSplitAudio = {
  file: File;
  runId: string;
  duration: number;
};

export function AutomaticTiming({
  project,
  file,
  duration,
  selectedId,
  onViewLyric,
  expanded,
  onCollapse,
  revealTiming,
  onChange,
  onListen,
  onIdentityReady,
  onSplitAudioReady,
  report,
  comparison = false,
  comparisonResults,
  selectedCandidate,
  onComparisonStart,
}: {
  comparison?: boolean;
  comparisonResults?: ReactNode;
  selectedCandidate?: string;
  onComparisonStart?: () => void;
  report?: (s: string) => void;
  project: Project;
  file: File | null;
  duration?: number;
  selectedId?: string;
  expanded: boolean;
  onCollapse: () => void;
  revealTiming: RefObject<HTMLButtonElement | null>;
  onViewLyric: (id: string) => void;
  onChange: (p: Project, id: string, preserveOrder?: boolean) => void;
  onListen: (bounds: { startMs: number; endMs: number }) => void;
  onSplitAudioReady?: (audio: VerifiedSplitAudio | undefined) => void;
  onIdentityReady: (ready: boolean) => void;
}) {
  const settings = project.timingSettings ?? defaultTimingSettings;
  const groq = settings.provider === "groq";
  const [models, setModels] = useState<string[]>([]);
  const [policy, setPolicy] = useState<GenerationPolicy>("preserve-reviewed");
  const [localTranscript, setTranscript] =
    useState<ReturnType<typeof parseWhisperTranscript>>();
  const transcript = groq ? undefined : localTranscript;
  const [transcriptName, setTranscriptName] = useState("");
  const [readingTranscript, setReadingTranscript] = useState(false);
  const [confirm, setConfirm] = useState<{
    kind: "replace" | "reuse" | "regenerate";
    trigger: HTMLButtonElement;
  }>();
  const [added, setAdded] = useState<{ id: string; text: string }>();
  const candidateList = useRef<HTMLUListElement>(null);
  const viewAdded = useRef<HTMLButtonElement>(null);
  const nextCandidateFocus = useRef<string | null | undefined>(undefined);

  const focusRerun = useRef(false);
  const [transcriptError, setTranscriptError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [percent, setPercent] = useState<number>();
  useEffect(() => {
    report?.(
      busy
        ? percent === undefined
          ? "Working…"
          : percent + "%"
        : failed
          ? "!"
          : "",
    );
    return () => report?.("");
  }, [busy, percent, report, failed]);
  const [deadline, setDeadline] = useState<number>();
  const [now, setNow] = useState(0);
  const [identity, setIdentity] = useState<{
    sha256: string;
    encoding: "mono-f32le-16000";
  }>();
  const [reuse, setReuse] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const inputs = JSON.stringify([
    project.occurrences,
    project.phrases.map((p) => [p.id, p.lyricKey]),
    project.timingRun,
    project.timingSettings,
  ]);
  const live = useRef({ project, file, selectedId, inputs, onChange });
  live.current = { project, file, selectedId, inputs, onChange };
  const pendingCandidates = useRef(new Set<string>());
  const [preparingCandidate, setPreparingCandidate] = useState<string>();
  const preparing = useRef(false);
  useEffect(() => {
    pendingCandidates.current.clear();
  }, [project]);
  useLayoutEffect(() => {
    const id = nextCandidateFocus.current;
    if (id === undefined) return;
    nextCandidateFocus.current = undefined;
    const target = [
      ...(candidateList.current?.querySelectorAll<HTMLButtonElement>(
        "button[data-add-candidate]",
      ) ?? []),
    ].find((button) => button.dataset.addCandidate === id && !button.disabled);
    const focus =
      target ??
      viewAdded.current ??
      candidateList.current?.closest("details")?.querySelector("summary") ??
      revealTiming.current;
    focus?.focus({ preventScroll: true });
    const list = candidateList.current;
    if (target && list) {
      const button = target.getBoundingClientRect(),
        bounds = list.getBoundingClientRect();
      if (button.top < bounds.top) list.scrollTop += button.top - bounds.top;
      else if (button.bottom > bounds.bottom)
        list.scrollTop += button.bottom - bounds.bottom;
    }
  }, [project]);
  useLayoutEffect(() => {
    if (!focusRerun.current || !project.timingRun || expanded) return;
    focusRerun.current = false;
    revealTiming.current?.focus({ preventScroll: true });
  }, [project.timingRun, expanded, revealTiming]);
  const [groqAvailable, setGroqAvailable] = useState(false);
  const model = groq
    ? (settings.groqModel ?? "whisper-large-v3-turbo")
    : settings.model;
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/translation/providers", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setGroqAvailable(Array.isArray(data.Groq)))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const previous = useRef(file);
  const input = useRef<HTMLInputElement>(null);
  const transcriptVersion = useRef(0);
  const runIdentity = project.timingRun?.audioIdentity;
  const match =
    !!identity && !!runIdentity && identity.sha256 === runIdentity.sha256;
  const ready = !!file && previous.current === file && (match || reuse);
  useEffect(() => {
    onIdentityReady(ready);
  }, [ready, onIdentityReady]);
  const splitRunId = project.timingRun?.id;
  useEffect(() => {
    onSplitAudioReady?.(
      ready && file && duration && splitRunId
        ? { file, runId: splitRunId, duration }
        : undefined,
    );
  }, [ready, file, duration, splitRunId, onSplitAudioReady]);
  useEffect(() => {
    void fetch("/api/timing-models")
      .then((r) => r.json())
      .then((v) => setModels(Array.isArray(v.models) ? v.models : []))
      .catch(() => setModels([]));
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    controller.current?.abort();
    setBusy(false);
  }, [inputs, file, transcript, policy]);
  useEffect(() => {
    setIdentity(undefined);
    setReuse(false);
    if (previous.current) {
      transcriptVersion.current++;
      setTranscript(undefined);
      setTranscriptName("");
      setReadingTranscript(false);
      setTranscriptError("");
      if (input.current) input.current.value = "";
    }
    previous.current = file;
  }, [file]);
  useEffect(() => {
    if (!busy || deadline === undefined) return;
    const timer = window.setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(timer);
  }, [busy, deadline]);
  const convertedAudio = useRef<{ file: File; wav: Blob } | undefined>(
    undefined,
  );
  const run = async (identityOnly = false, englishRetry = false) => {
    if (!file || !duration || busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    if (!identityOnly && !englishRetry) onComparisonStart?.();
    setFailed(false);
    setStatus(identityOnly ? "Checking normalized audio…" : "Uploading audio…");
    setPercent(undefined);
    setDeadline(undefined);
    const source = inputs,
      audio = file;
    try {
      const request = async (media: Blob) => {
        const response = await fetch("/api/automatic-timing", {
          method: "POST",
          signal: abort.signal,
          body: new Blob([
            JSON.stringify({
              project,
              durationMs: duration,
              model,
              provider: settings.provider ?? "local",
              language: settings.language ?? "zh",
              englishRetry,
              expectedAudioSha256: englishRetry
                ? project.timingRun?.audioIdentity?.sha256
                : undefined,
              transcript: identityOnly || englishRetry ? undefined : transcript,
              identityOnly,
              ids: project.occurrences.map((o) => o.id),
              startMs: 0,
              endMs: duration,
            }) + "\n",
            media,
          ]),
        });
        if (!response.body) throw Error("Timing service unavailable.");
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let buffer = "",
          result: unknown,
          hash: typeof identity,
          failure: Error | undefined;
        const consume = (line: string) => {
          if (!line.trim()) return;
          const message = JSON.parse(line);
          if (message.error)
            failure ??= Object.assign(Error(message.error), {
              code: message.code,
            });
          if (message.progress) setStatus(message.progress);
          if (Number.isFinite(message.transcriptionPercent))
            setPercent(message.transcriptionPercent);
          if (Number.isFinite(message.etaSeconds)) {
            const n = performance.now();
            setNow(n);
            setDeadline(n + message.etaSeconds * 1000);
          }
          if (message.audioIdentity)
            hash = audioIdentitySchema.parse(message.audioIdentity);
          if (message.result) result = message.result;
        };
        try {
          while (true) {
            const chunk = await reader.read();
            abort.signal.throwIfAborted();
            if (chunk.done) break;
            buffer += decoder.decode(chunk.value, { stream: true });
            let newline: number;
            while ((newline = buffer.indexOf("\n")) >= 0) {
              consume(buffer.slice(0, newline));
              buffer = buffer.slice(newline + 1);
            }
          }
          consume(buffer);
          if (failure) throw failure;
          return { result, hash };
        } finally {
          await reader.cancel().catch(() => {});
        }
      };
      const cached =
        convertedAudio.current?.file === audio
          ? convertedAudio.current.wav
          : undefined;
      let packet: Awaited<ReturnType<typeof request>>;
      try {
        packet = await request(cached ?? audio);
      } catch (error) {
        if (
          cached ||
          !(error instanceof Error) ||
          !("code" in error) ||
          error.code !== "media-decode"
        )
          throw error;
        abort.signal.throwIfAborted();
        setStatus("Decoding audio in the browser…");
        let wav: Blob;
        try {
          wav = await timingWav(audio, abort.signal);
        } catch {
          abort.signal.throwIfAborted();
          throw Error(
            "Neither the timing worker nor this browser could decode the linked audio.",
          );
        }
        convertedAudio.current = { file: audio, wav };
        packet = await request(wav);
      }
      const { result, hash } = packet;
      if (
        abort.signal.aborted ||
        controller.current !== abort ||
        live.current.inputs !== source ||
        live.current.file !== audio
      )
        return;
      setIdentity(hash);
      if (identityOnly) {
        if (!hash) throw Error("Audio identity could not be checked.");
        setStatus("");
      } else if (englishRetry) {
        if (!result) throw Error("English retry ended without results.");
        const current = live.current.project;
        const previousIdentity = current.timingRun?.audioIdentity;
        if (previousIdentity && previousIdentity.sha256 !== hash?.sha256)
          throw Error("The linked audio differs from the original timing run.");
        const before = englishRetryIds(current);
        const next = applyEnglishRetry(
          current,
          result,
          duration,
          settings.provider ?? "local",
          model,
        );
        const remaining = englishRetryIds(next);
        const first = before.find((id) => !remaining.includes(id));
        if (next !== current)
          live.current.onChange(next, first ?? selectedId ?? before[0], true);
        const estimates = next.occurrences.filter(
          (o) => remaining.includes(o.id) && o.weakTiming,
        ).length;
        setStatus(
          `English retry timed ${before.length - remaining.length} lyrics. ${remaining.length} remain untimed${estimates ? `, including ${estimates} with estimates` : ""}.`,
        );
      } else {
        if (!result)
          throw Error("Timing ended without results; project retained.");
        const next = applyGeneration(
          live.current.project,
          result,
          duration,
          policy,
          {
            id: crypto.randomUUID(),
            model: transcript ? "imported transcript" : model,
            provider: transcript ? undefined : (settings.provider ?? "local"),
            transcriptProvenance: transcript
              ? "external-unverified"
              : "generated",
            audioIdentity: hash,
          },
        );
        focusRerun.current = true;
        setPolicy("preserve-reviewed");
        onCollapse();
        setAdded(undefined);
        const generated = next.occurrences.find(
          (o) =>
            o.automaticTiming?.runId === next.timingRun?.id &&
            o.timingReview !== "reviewed",
        );
        live.current.onChange(
          next,
          generated?.id ?? selectedId ?? next.occurrences[0]?.id ?? "",
          true,
        );
        setStatus("Timings generated.");
      }
    } catch (e) {
      if (!abort.signal.aborted) {
        setFailed(true);
        setStatus(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (controller.current === abort) setBusy(false);
    }
  };
  const clearTranscript = () => {
    transcriptVersion.current++;
    setTranscript(undefined);
    setTranscriptName("");
    setReadingTranscript(false);
    setTranscriptError("");
    if (input.current) input.current.value = "";
  };
  const counts = { Reviewed: 0, "Needs review": 0, Untimed: 0 };
  project.occurrences.forEach((o) => counts[timingStatus(o, duration)]++);
  const candidates =
    project.timingRun?.candidates.filter((c) => !needsImportSplit(c)) ?? [];
  const lastAdded =
    added && project.occurrences.some((o) => o.id === added.id)
      ? added
      : undefined;
  const unavailable = busy || !file || !duration || !project.occurrences.length;
  const modelUnavailable = groq
    ? !groqAvailable
    : !models.includes(settings.model);
  const disabled =
    unavailable ||
    (!groq && (readingTranscript || !!transcriptError)) ||
    (!transcript && modelUnavailable);
  const dismissCandidates = (id?: string) => {
    const run = project.timingRun;
    if (!run) return;
    nextCandidateFocus.current = id
      ? (candidates.find((candidate, index) => candidates[index - 1]?.id === id)
          ?.id ?? null)
      : null;
    setAdded(undefined);
    onChange(
      {
        ...project,
        timingRun: {
          ...run,
          candidates: id
            ? run.candidates.filter((candidate) => candidate.id !== id)
            : run.candidates.filter(needsImportSplit),
        },
      },
      selectedId ?? project.occurrences[0]?.id ?? "",
      true,
    );
  };
  return (
    <section
      className="automatic-timing"
      aria-label="Automatic timing"
      hidden={
        !comparison &&
        !!project.timingRun &&
        !expanded &&
        !candidates.length &&
        !lastAdded
      }
    >
      <div
        id="automatic-timing-content"
        hidden={!!project.timingRun && !expanded}
      >
        <div className="automatic-timing-header">
          <div>
            <h2>
              {comparison ? "Transcription settings" : "Automatic timing"}
            </h2>
            <p className="muted">
              {counts.Reviewed} reviewed · {counts["Needs review"]} need review
              · {counts.Untimed} untimed
            </p>
          </div>
        </div>
        <div id="automatic-timing-setup">
          <div className="timing-controls automatic-timing-setup">
            <label>
              Transcription provider
              <select
                disabled={busy}
                value={settings.provider ?? "local"}
                onChange={(e) =>
                  onChange(
                    {
                      ...project,
                      timingSettings: {
                        ...settings,
                        provider: e.target.value as "local" | "groq",
                      },
                    },
                    selectedId ?? project.occurrences[0]?.id ?? "",
                    true,
                  )
                }
              >
                <option value="local">Local Whisper</option>
                <option value="groq" disabled={!groqAvailable}>
                  Groq{groqAvailable ? "" : " (requires GROQ_API_KEY)"}
                </option>
              </select>
            </label>
            {groq ? (
              <label>
                Groq Whisper model
                <select
                  disabled={busy}
                  value={model}
                  onChange={(e) =>
                    onChange(
                      {
                        ...project,
                        timingSettings: {
                          ...settings,
                          groqModel: e.target
                            .value as typeof settings.groqModel,
                        },
                      },
                      selectedId ?? project.occurrences[0]?.id ?? "",
                      true,
                    )
                  }
                >
                  <option value="whisper-large-v3-turbo">Large V3 Turbo</option>
                  <option value="whisper-large-v3">Large V3</option>
                </select>
              </label>
            ) : (
              <label>
                Cached model
                <select
                  value={settings.model}
                  disabled={busy}
                  onChange={(e) =>
                    onChange(
                      {
                        ...project,
                        timingSettings: {
                          ...settings,
                          model: e.target.value as typeof settings.model,
                        },
                      },
                      selectedId ?? project.occurrences[0]?.id ?? "",
                      true,
                    )
                  }
                >
                  {!models.includes(settings.model) && (
                    <option value={settings.model}>
                      {settings.model} (not cached)
                    </option>
                  )}
                  {models.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            )}
            {!transcript && (
              <label>
                Transcription language
                <select
                  value={settings.language ?? "zh"}
                  disabled={busy}
                  onChange={(e) =>
                    onChange(
                      {
                        ...project,
                        timingSettings: {
                          ...settings,
                          language: e.target.value === "auto" ? "auto" : "zh",
                        },
                      },
                      selectedId ?? project.occurrences[0]?.id ?? "",
                      true,
                    )
                  }
                >
                  <option value="zh">Mandarin</option>
                  <option value="auto">Auto-detect</option>
                </select>
              </label>
            )}
            {(project.timingRun ||
              project.occurrences.some(
                (o) => o.startMs !== null || o.endMs !== null,
              )) && (
              <label>
                Regeneration
                <select
                  value={policy}
                  disabled={busy}
                  onChange={(e) =>
                    setPolicy(e.target.value as GenerationPolicy)
                  }
                >
                  <option value="preserve-reviewed">
                    Preserve reviewed timings
                  </option>
                  <option value="replace-all">
                    Replace all regular timings…
                  </option>
                </select>
              </label>
            )}
            <button
              className="primary"
              disabled={disabled}
              onClick={(e) => {
                if (policy === "replace-all")
                  setConfirm({ kind: "replace", trigger: e.currentTarget });
                else if (project.timingRun?.candidates.length)
                  setConfirm({ kind: "regenerate", trigger: e.currentTarget });
                else void run();
              }}
            >
              {comparison ? "Transcribe and compare" : "Generate timings"}
            </button>
          </div>
          {groq && (
            <p className="muted">
              Generating timings sends the linked audio to Groq.
            </p>
          )}
          {!groq && (
            <details className="timing-advanced">
              <summary>
                Advanced
                {transcriptError
                  ? " · Transcript needs attention"
                  : transcriptName
                    ? " · Transcript selected"
                    : ""}
              </summary>
              <div className="timing-controls">
                <label>
                  Optional Whisper transcript
                  <input
                    ref={input}
                    type="file"
                    accept=".json"
                    disabled={busy}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) {
                        clearTranscript();
                        return;
                      }
                      const version = ++transcriptVersion.current;
                      setTranscriptName(f.name);
                      setReadingTranscript(true);
                      setTranscript(undefined);
                      setTranscriptError("");
                      try {
                        if (f.size > 4_000_000)
                          throw Error(
                            "Choose a transcript under 4 MB, or clear the transcript.",
                          );
                        const value = parseWhisperTranscript(await f.text());
                        if (version === transcriptVersion.current)
                          setTranscript(value);
                      } catch (error) {
                        if (version === transcriptVersion.current)
                          setTranscriptError(
                            error instanceof Error
                              ? error.message
                              : String(error),
                          );
                      } finally {
                        if (version === transcriptVersion.current)
                          setReadingTranscript(false);
                      }
                    }}
                  />
                </label>
                {transcriptName && (
                  <button
                    disabled={busy}
                    onClick={() => {
                      input.current?.focus();
                      clearTranscript();
                    }}
                  >
                    Clear transcript
                  </button>
                )}
              </div>
              <p className="muted">
                Use a Whisper JSON with word timestamps from this recording.
              </p>
            </details>
          )}
        </div>
      </div>
      <div className="automatic-timing-feedback">
        {!comparison &&
          project.timingRun &&
          englishRetryIds(project).length > 0 && (
            <button
              disabled={unavailable || modelUnavailable}
              onClick={() => void run(false, true)}
            >
              Retry untimed lyrics in English
            </button>
          )}
        {busy && (
          <button
            onClick={() => {
              controller.current?.abort();
              setBusy(false);
              setStatus("Cancelled; project retained.");
            }}
          >
            Cancel timing
          </button>
        )}
        {busy && (
          <progress
            aria-label="Transcription progress"
            max={100}
            value={percent}
          />
        )}
        {busy && deadline !== undefined && (
          <span aria-label="Estimated time remaining">
            {formatTimingEta(deadline, now)}
          </span>
        )}
        <p
          role="status"
          className={!groq && transcriptError ? "timing-notice" : "muted"}
        >
          {(!groq && transcriptError) || status}{" "}
          {failed && (
            <button onClick={() => setFailed(false)}>
              Dismiss notification
            </button>
          )}
        </p>
      </div>
      {file &&
        duration &&
        project.timingRun &&
        ((!match && !reuse) ||
          project.timingRun.transcriptProvenance === "external-unverified") && (
          <div className="timing-audio-identity">
            <p className="muted">
              {!match &&
                !reuse &&
                (identity
                  ? "Linked audio differs from the generation recording. "
                  : "Linked audio unchecked. ")}
              {project.timingRun.transcriptProvenance ===
                "external-unverified" &&
                "Imported transcript provenance is unverified."}
            </p>
            {!match && !reuse && (
              <div className="timing-controls">
                <button
                  disabled={busy || !file || !duration}
                  onClick={() => void run(true)}
                >
                  Check linked audio
                </button>
                <button
                  disabled={!file || busy}
                  onClick={(e) =>
                    setConfirm({ kind: "reuse", trigger: e.currentTarget })
                  }
                >
                  Reuse with this audio…
                </button>
              </div>
            )}
          </div>
        )}
      {lastAdded && (
        <div className="timing-candidate-added">
          <p role="status">
            Added <strong>{lastAdded.text}</strong> to lyrics.
          </p>
          <button
            ref={viewAdded}
            onClick={() => {
              const disclosure = candidateList.current?.closest("details");
              if (disclosure) disclosure.open = false;
              onViewLyric(lastAdded.id);
              setAdded(undefined);
            }}
          >
            View lyric
          </button>
        </div>
      )}
      {candidates.length > 0 && (
        <details className="timing-candidates" open={comparison || undefined}>
          <summary>
            Detected from audio · {candidates.length}{" "}
            {candidates.length === 1 ? "passage" : "passages"} available
          </summary>
          <button
            disabled={busy || !!preparingCandidate}
            onClick={() => dismissCandidates()}
          >
            Clear detected passages
          </button>
          <ul
            ref={candidateList}
            className="timing-candidate-list"
            tabIndex={0}
            aria-label="Detected passages, scroll for more"
          >
            {candidates.map((c, index) => (
              <li
                key={c.id}
                data-candidate={c.id}
                data-selected={selectedCandidate === c.id}
              >
                <strong>
                  {c.text}
                  {comparison && (
                    <small>
                      {" "}
                      ·{" "}
                      {(() => {
                        const after = project.occurrences.find(
                          (o) => o.startMs !== null && o.startMs > c.startMs,
                        );
                        return after
                          ? "Before " +
                              project.phrases.find(
                                (p) => p.id === after.phraseId,
                              )?.lyricKey
                          : "At end of song";
                      })()}
                    </small>
                  )}
                </strong>
                <span className="timing-candidate-range">
                  {formatTime(c.startMs)}–{formatTime(c.endMs)}
                </span>
                <div className="timing-candidate-actions">
                  <button disabled={!ready || busy} onClick={() => onListen(c)}>
                    Listen
                  </button>
                  <button
                    data-add-candidate={c.id}
                    disabled={
                      !ready || busy || preparingCandidate !== undefined
                    }
                    onClick={async () => {
                      if (
                        preparing.current ||
                        pendingCandidates.current.has(c.id)
                      )
                        return;
                      try {
                        const current = live.current.project;
                        const audio = live.current.file;
                        let words;
                        if (
                          !c.words &&
                          !current.phrases.some(
                            (phrase) => phrase.lyricKey === c.text,
                          )
                        ) {
                          preparing.current = true;
                          setPreparingCandidate(c.id);
                          words = await draftDetectedWords(c.text);
                          if (
                            live.current.project !== current ||
                            live.current.file !== audio
                          )
                            throw Error(
                              "The project or audio changed. Add the passage again when ready.",
                            );
                        }
                        const next = addDetectedCandidate(
                          current,
                          c.id,
                          duration,
                          words,
                        );
                        if (next === current) return;
                        if (!comparison) pendingCandidates.current.add(c.id);
                        nextCandidateFocus.current =
                          candidates[index + 1]?.id ?? null;
                        if (!comparison) setAdded({ id: c.id, text: c.text });
                        onChange(
                          next,
                          live.current.selectedId ??
                            current.occurrences[0]?.id ??
                            c.id,
                          true,
                        );
                      } catch (error) {
                        setStatus(
                          error instanceof Error
                            ? error.message
                            : String(error),
                        );
                      } finally {
                        preparing.current = false;
                        setPreparingCandidate(undefined);
                      }
                    }}
                  >
                    {preparingCandidate === c.id
                      ? "Preparing…"
                      : comparison
                        ? "Review insertion"
                        : "Add lyric"}
                  </button>
                  <button
                    aria-label={`Dismiss passage: ${c.text}`}
                    disabled={busy || !!preparingCandidate}
                    onClick={() => dismissCandidates(c.id)}
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
      {comparisonResults}
      {confirm && (
        <TimingConfirmDialog
          title={
            confirm.kind === "replace"
              ? "Replace current timings?"
              : confirm.kind === "regenerate"
                ? "Replace pending detected passages?"
                : "Reuse with this audio?"
          }
          action={
            confirm.kind === "replace"
              ? "Replace and regenerate"
              : confirm.kind === "regenerate"
                ? "Regenerate and replace passages"
                : "Reuse timings"
          }
          trigger={confirm.trigger}
          onCancel={() => setConfirm(undefined)}
          onConfirm={() => {
            setConfirm(undefined);
            if (confirm.kind !== "reuse" && !disabled) void run();
            if (confirm.kind === "reuse" && file && !busy) {
              setReuse(true);
              setStatus(
                "Reuse approved. Listen to estimates and passages against this recording.",
              );
            }
          }}
        >
          {confirm.kind === "replace"
            ? `Regular suggestions can replace timings across ${project.occurrences.length} lyrics, including ${counts.Reviewed} reviewed. Changed timings will need review. Your last-reviewed timings remain available for reset.`
            : confirm.kind === "reuse"
              ? "Stored passages and estimates may refer to a different recording. Listen to each one before using it."
              : "Add the passages you want to keep or download a project backup before regenerating."}
          {confirm.kind !== "reuse" &&
            !!project.timingRun?.candidates.length &&
            ` A successful run replaces the ${project.timingRun.candidates.length} pending detected passages. Any passages already added to lyrics stay in the song.`}
        </TimingConfirmDialog>
      )}
    </section>
  );
}
