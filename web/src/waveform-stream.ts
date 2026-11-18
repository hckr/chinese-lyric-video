import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from "mediabunny";
import { waveformAllowed } from "./waveform.ts";

export const MAX_CHANNEL_SAMPLES = 48_000_000;
const MAX_CHANNELS = 8;
const COPY_FRAMES = 4096;
type Sample = {
  numberOfChannels: number;
  numberOfFrames: number;
  sampleRate: number;
  timestamp: number;
  copyTo(
    destination: Float32Array,
    options: {
      planeIndex: number;
      format: "f32-planar";
      frameOffset: number;
      frameCount: number;
    },
  ): void;
  close(): void;
};
export function checkAudioBudget(
  channels: number,
  rate: number,
  durationMs: number,
) {
  if (!waveformAllowed(durationMs))
    throw Error(
      "Waveform skipped: audio duration exceeds the eight-minute analysis limit.",
    );
  if (
    !Number.isInteger(channels) ||
    channels < 1 ||
    channels > MAX_CHANNELS ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    rate > 192000 ||
    (channels * rate * durationMs) / 1000 > MAX_CHANNEL_SAMPLES
  )
    throw Error(
      "Waveform skipped: decoded audio exceeds the sample-processing limit.",
    );
}
export async function peaksFromSamples(
  samples: AsyncIterable<Sample>,
  durationMs: number,
  signal: AbortSignal,
  audioDurationMs = durationMs,
): Promise<number[]> {
  const peaks = new Array<number>(1600).fill(0);
  const scratch = new Float32Array(COPY_FRAMES);
  let processed = 0,
    seen = false,
    lastYield = performance.now();
  for await (const sample of samples) {
    try {
      signal.throwIfAborted();
      checkAudioBudget(
        sample.numberOfChannels,
        sample.sampleRate,
        audioDurationMs,
      );
      if (
        !Number.isSafeInteger(sample.numberOfFrames) ||
        sample.numberOfFrames < 0 ||
        !Number.isFinite(sample.timestamp)
      )
        throw Error("Waveform unavailable: invalid decoded audio samples.");
      processed += sample.numberOfFrames * sample.numberOfChannels;
      if (processed > MAX_CHANNEL_SAMPLES)
        throw Error(
          "Waveform skipped: decoded audio exceeds the sample-processing limit.",
        );
      for (
        let offset = 0;
        offset < sample.numberOfFrames;
        offset += COPY_FRAMES
      ) {
        signal.throwIfAborted();
        const count = Math.min(COPY_FRAMES, sample.numberOfFrames - offset);
        for (let channel = 0; channel < sample.numberOfChannels; channel++) {
          sample.copyTo(scratch, {
            planeIndex: channel,
            format: "f32-planar",
            frameOffset: offset,
            frameCount: count,
          });
          for (let i = 0; i < count; i++) {
            const time = sample.timestamp + (offset + i) / sample.sampleRate;
            const bin = Math.floor(((time * 1000) / durationMs) * peaks.length);
            if (bin >= 0 && bin < peaks.length) {
              peaks[bin] = Math.max(
                peaks[bin],
                Math.min(1, Math.abs(scratch[i]) || 0),
              );
              seen = true;
            }
          }
        }
        // Give file replacement, cancellation and the media controls time to run.
        if (performance.now() - lastYield > 16) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          lastYield = performance.now();
        }
      }
    } finally {
      sample.close();
    }
  }
  signal.throwIfAborted();
  if (!seen)
    throw Error("Waveform unavailable: no audio samples were decoded.");
  return peaks;
}
export async function decodeWaveform(
  file: File,
  durationMs: number,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (!Number.isFinite(durationMs) || durationMs <= 0)
    throw Error("Waveform unavailable: invalid media duration.");
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file, { maxCacheSize: 4 * 1024 * 1024 }),
  });
  let timedOut = false;
  const dispose = () => input.dispose();
  signal.addEventListener("abort", dispose, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    input.dispose();
  }, 60000);
  try {
    const track = await input.getPrimaryAudioTrack();
    signal.throwIfAborted();
    if (!track)
      throw Error("Waveform unavailable: this file has no audio track.");
    const audioDurationMs =
      ((await track.computeDuration()) - (await track.getFirstTimestamp())) *
      1000;
    signal.throwIfAborted();
    checkAudioBudget(
      await track.getNumberOfChannels(),
      await track.getSampleRate(),
      audioDurationMs,
    );
    if (!(await track.canDecode()))
      throw Error(
        "Waveform unavailable: this browser cannot decode the audio codec for analysis.",
      );
    const peaks = await peaksFromSamples(
      new AudioSampleSink(track).samples(),
      durationMs,
      signal,
      audioDurationMs,
    );
    if (timedOut) throw Error("Waveform processing timed out.");
    return peaks;
  } catch (error) {
    if (timedOut)
      throw Error(
        "Waveform analysis stopped after the 60-second processing limit.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", dispose);
    input.dispose();
  }
}
