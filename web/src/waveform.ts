// Downsample decoded local samples into bounded peaks, including both channels.
export function waveformPeaks(channels: Float32Array[], bins = 1600): number[] {
  const length = Math.max(0, ...channels.map((c) => c.length));
  if (!length || bins <= 0) return [];
  const count = Math.min(Math.floor(bins), length);
  const peaks = new Array<number>(count).fill(0);
  for (let bin = 0; bin < count; bin++) {
    const from = Math.floor((bin * length) / count),
      to = Math.floor(((bin + 1) * length) / count);
    for (const channel of channels)
      for (let i = from; i < Math.min(to, channel.length); i++)
        peaks[bin] = Math.max(peaks[bin], Math.abs(channel[i]));
  }
  return peaks;
}
export function waveformAllowed(durationMs: number): boolean {
  return (
    Number.isFinite(durationMs) && durationMs > 0 && durationMs <= 8 * 60 * 1000
  );
}
