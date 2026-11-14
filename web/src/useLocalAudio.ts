import { useEffect, useRef, useState } from "react";
import type { Project } from "./domain.ts";
import { mediaMs } from "./timing.ts";
import { waveformAllowed, waveformPeaks } from "./waveform.ts";

export function useLocalAudio(
  active: boolean,
  onMetadata: (audio: NonNullable<Project["audio"]>) => void,
  loop: { startMs: number; endMs: number } | null,
) {
  const ref = useRef<HTMLAudioElement>(null);
  const file = useRef<File | null>(null);
  const version = useRef(0);
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
    },
    [],
  );
  useEffect(() => {
    if (!active) ref.current?.pause();
  }, [active]);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    let frame = 0;
    const update = () => {
      const range = live.current.loop;
      if (
        !audio.paused &&
        range &&
        range.endMs <= mediaMs(audio.duration) &&
        (mediaMs(audio.currentTime) >= range.endMs ||
          mediaMs(audio.currentTime) < range.startMs)
      )
        audio.currentTime = range.startMs / 1000;
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
      const range = live.current.loop;
      if (range && range.endMs <= mediaMs(audio.duration)) {
        audio.currentTime = range.startMs / 1000;
        void audio
          .play()
          .catch(() => setError("Could not restart loop playback."));
      } else pause();
    };
    audio.addEventListener("play", play);
    audio.addEventListener("pause", pause);
    audio.addEventListener("ended", ended);
    audio.addEventListener("seeked", update);
    audio.addEventListener("timeupdate", update);
    return () => {
      cancelAnimationFrame(frame);
      audio.removeEventListener("play", play);
      audio.removeEventListener("pause", pause);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("seeked", update);
      audio.removeEventListener("timeupdate", update);
      audio.pause();
    };
  }, []);
  const load = (next: File) => {
    version.current++;
    ref.current?.pause();
    file.current = next;
    setError("");
    setDuration(undefined);
    setPosition(0);
    setPeaks([]);
    setWaveStatus("Waiting for audio metadata…");
    setUrl(URL.createObjectURL(next));
  };
  const metadata = async () => {
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
    live.current.onMetadata({
      name: selected.name,
      size: selected.size,
      lastModified: selected.lastModified,
      durationMs: duration,
    });
    if (!waveformAllowed(selected.size, duration)) {
      setWaveStatus(
        "Waveform skipped for this large file. Playback and timing remain available.",
      );
      return;
    }
    setWaveStatus("Analyzing local audio…");
    let context: AudioContext | undefined;
    try {
      context = new AudioContext({ sampleRate: 16000 });
      const decoded = await context.decodeAudioData(
        await selected.arrayBuffer(),
      );
      if (version.current !== generation) return;
      const channels = Array.from(
        { length: decoded.numberOfChannels },
        (_, i) => decoded.getChannelData(i),
      );
      setPeaks(waveformPeaks(channels));
      setWaveStatus("");
    } catch {
      if (version.current === generation)
        setWaveStatus(
          "Waveform analysis unavailable. Use the ruler; audio playback is independent.",
        );
    } finally {
      await context?.close().catch(() => {});
    }
  };
  const seek = (ms: number) => {
    const audio = ref.current;
    if (!audio || durationMs === undefined) return;
    audio.currentTime =
      Math.min(durationMs, Math.max(0, Math.round(ms))) / 1000;
    setPosition(mediaMs(audio.currentTime));
  };
  const toggle = () => {
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
  const mediaError = () => {
    version.current++;
    setPlaying(false);
    setDuration(undefined);
    setPeaks([]);
    setWaveStatus("Waveform unavailable for this file.");
    setError(
      "This file could not be played. Choose a supported local audio file; your project and timings are retained.",
    );
  };
  return {
    ref,
    url,
    durationMs,
    positionMs,
    playing,
    peaks,
    waveStatus,
    error,
    load,
    metadata,
    seek,
    toggle,
    mediaError,
  };
}
