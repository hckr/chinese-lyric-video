import { useEffect, useRef, useState } from "react";
import type { Project } from "./domain.ts";
import { mediaMs } from "./timing.ts";
import { decodeWaveform, probeTracks } from "./waveform-stream.ts";

export function useLocalAudio(
  selectedFile: File | null,
  active: boolean,
  onMetadata: (audio: NonNullable<Project["audio"]>) => void,
  loop: { startMs: number; endMs: number } | null,
) {
  const ref = useRef<HTMLAudioElement>(null);
  const bounded = useRef<{
    startMs: number;
    endMs: number;
    loop: boolean;
  } | null>(null);
  const cancelBounded = () => {
    bounded.current = null;
  };
  const file = useRef<File | null>(null);
  const version = useRef(0);
  const [waveSource, setWaveSource] = useState<{
    file: File;
    duration: number;
  }>();
  const completedWave = useRef<typeof waveSource>(undefined);
  const analysis = useRef<AbortController | null>(null);
  const [url, setUrl] = useState("");
  const [durationMs, setDuration] = useState<number>();
  const [positionMs, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [waveStatus, setWaveStatus] = useState("");
  const [error, setError] = useState("");
  const live = useRef({ onMetadata, loop });
  live.current = { onMetadata, loop };
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  useEffect(
    () => () => {
      version.current++;
      analysis.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!active) {
      bounded.current = null;
      ref.current?.pause();
    }
  }, [active]);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    let frame = 0;
    const update = () => {
      const range =
        bounded.current ??
        (live.current.loop ? { ...live.current.loop, loop: true } : null);
      if (
        !audio.paused &&
        range &&
        range.endMs <= mediaMs(audio.duration) &&
        (mediaMs(audio.currentTime) >= range.endMs ||
          mediaMs(audio.currentTime) < range.startMs)
      ) {
        if (range.loop) audio.currentTime = range.startMs / 1000;
        else {
          bounded.current = null;
          audio.currentTime = range.endMs / 1000;
          audio.pause();
        }
      }
      setPosition(mediaMs(audio.currentTime));
    };
    const tick = () => {
      update();
      frame = requestAnimationFrame(tick);
    };
    const play = () => {
      setPlaying(true);
      cancelAnimationFrame(frame);
      tick();
    };
    const pause = () => {
      setPlaying(false);
      cancelAnimationFrame(frame);
      update();
    };
    const ended = () => {
      const range =
        bounded.current ??
        (live.current.loop ? { ...live.current.loop, loop: true } : null);
      if (range?.loop && range.endMs <= mediaMs(audio.duration)) {
        audio.currentTime = range.startMs / 1000;
        void audio
          .play()
          .catch(() => setError("Could not restart loop playback."));
      } else pause();
    };
    audio.addEventListener("play", play);
    audio.addEventListener("pause", pause);
    audio.addEventListener("ended", ended);
    const seeked = () => {
      const range = bounded.current;
      if (
        range &&
        (mediaMs(audio.currentTime) < range.startMs ||
          mediaMs(audio.currentTime) > range.endMs)
      )
        bounded.current = null;
      update();
    };
    audio.addEventListener("seeked", seeked);
    audio.addEventListener("timeupdate", update);
    return () => {
      cancelAnimationFrame(frame);
      audio.removeEventListener("play", play);
      audio.removeEventListener("pause", pause);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("seeked", seeked);
      audio.removeEventListener("timeupdate", update);
      audio.pause();
    };
  }, []);
  useEffect(() => {
    if (!selectedFile) return;
    cancelBounded();
    version.current++;
    analysis.current?.abort();
    ref.current?.pause();
    file.current = selectedFile;
    setError("");
    setWaveSource(undefined);
    completedWave.current = undefined;
    setDuration(undefined);
    setPosition(0);
    setPeaks([]);
    setWaveStatus("Waiting for audio metadata…");
    setUrl(URL.createObjectURL(selectedFile));
  }, [selectedFile]);
  const metadata = () => {
    const audio = ref.current,
      selected = file.current,
      generation = version.current;
    if (!audio || !selected) return;
    const duration = mediaMs(audio.duration);
    if (!Number.isSafeInteger(duration) || duration <= 0) {
      setError("Audio has no finite duration. Choose a playable local file.");
      return;
    }
    setDuration(duration);
    const baseMetadata = {
      name: selected.name,
      size: selected.size,
      lastModified: selected.lastModified,
      durationMs: duration,
    };
    live.current.onMetadata(baseMetadata);
    void probeTracks(selected)
      .then((tracks) => {
        if (version.current === generation && file.current === selected)
          live.current.onMetadata({ ...baseMetadata, ...tracks });
      })
      .catch(() => {
        /* Native playback remains available for unrecognized containers. */
      });
    setWaveSource((prev) =>
      prev?.file === selected && prev.duration === duration
        ? prev
        : { file: selected, duration },
    );
  };
  useEffect(() => {
    if (
      !active ||
      !waveSource ||
      waveSource.file !== selectedFile ||
      completedWave.current === waveSource
    )
      return;
    const controller = new AbortController();
    analysis.current = controller;
    setWaveStatus("Analyzing audio track…");
    void decodeWaveform(waveSource.file, waveSource.duration, controller.signal)
      .then((values) => {
        if (controller.signal.aborted) return;
        completedWave.current = waveSource;
        setPeaks(values);
        setWaveStatus("");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        completedWave.current = waveSource;
        setWaveStatus(
          `${error instanceof Error ? error.message : "Waveform analysis unavailable."} Playback and timing remain available.`,
        );
      });
    return () => {
      controller.abort();
      if (analysis.current === controller) analysis.current = null;
    };
  }, [active, waveSource, selectedFile]);

  const seek = (ms: number) => {
    const audio = ref.current;
    if (!audio || durationMs === undefined) return;
    if (
      bounded.current &&
      (ms < bounded.current.startMs || ms >= bounded.current.endMs)
    )
      cancelBounded();
    audio.currentTime =
      Math.min(durationMs, Math.max(0, Math.round(ms))) / 1000;
    setPosition(mediaMs(audio.currentTime));
  };
  const toggle = () => {
    cancelBounded();
    const audio = ref.current;
    if (!audio || durationMs === undefined) return;
    if (audio.paused) {
      setError("");
      void audio
        .play()
        .catch(() =>
          setError("Playback failed. Reselect a supported audio file."),
        );
    } else audio.pause();
  };
  const playSegment = (
    bounds: { startMs: number; endMs: number },
    repeat = false,
  ) => {
    const audio = ref.current;
    if (!audio || durationMs === undefined) return;
    const startMs = Math.max(0, bounds.startMs),
      endMs = Math.min(durationMs, bounds.endMs);
    if (endMs <= startMs) return;
    bounded.current = { startMs, endMs, loop: repeat };
    audio.currentTime = startMs / 1000;
    void audio.play().catch(() => {
      cancelBounded();
      setError("Playback failed.");
    });
  };
  const mediaError = () => {
    cancelBounded();
    version.current++;
    analysis.current?.abort();
    setPlaying(false);
    setDuration(undefined);
    setPeaks([]);
    setWaveSource(undefined);
    setWaveStatus("Waveform unavailable for this file.");
    setError(
      "This file could not be played. Choose a supported local audio file; your project and timings are retained.",
    );
  };
  return {
    file,
    playSegment,
    cancelBounded,
    ref,
    url,
    durationMs,
    positionMs,
    playing,
    peaks,
    waveStatus,
    error,
    metadata,
    seek,
    toggle,
    mediaError,
  };
}
