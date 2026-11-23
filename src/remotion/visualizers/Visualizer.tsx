import React, { CSSProperties } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";

/**
 * FFT frequency-bar visualizer extracted from LyricVideo2. Renders two
 * AbsoluteFill layers (top-anchored and bottom-anchored bars) so it can be
 * composed twice in LyricVideo2 to achieve the double-blend effect.
 */
export const Visualizer: React.FC<{
  bars?: "both" | "top" | "bottom";
  color?: string;
  intensity?: number;
  audioData: ReturnType<typeof useAudioData>;
  dataOffsetInSeconds?: number;
  blendLayer?: boolean;
}> = ({
  audioData,
  color = "white",
  intensity = 1,
  bars = "both",
  dataOffsetInSeconds = 0,
  blendLayer = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  if (!audioData) return null;

  const logScale = (v: number, floor = 0.001) => {
    const clamped = Math.max(v, floor);
    return (Math.log(clamped) - Math.log(floor)) / (0 - Math.log(floor));
  };

  const SMOOTHING_FRAMES = 7;
  const DECAY = 0.5;
  const numberOfSamples = 64;

  const smoothed = new Array(numberOfSamples).fill(0);
  let totalWeight = 0;

  for (let back = 0; back < SMOOTHING_FRAMES; back++) {
    const sampleFrame = Math.max(0, frame - back);
    const weight = Math.pow(DECAY, back);

    const raw = visualizeAudio({
      fps,
      frame: sampleFrame,
      audioData,
      numberOfSamples,
      dataOffsetInSeconds,
    });

    raw.forEach((v, i) => {
      smoothed[i] += logScale(v) * weight;
    });

    totalWeight += weight;
  }

  const boosted = smoothed.map((v) => v / totalWeight);
  const mirrored = boosted.concat([...boosted].reverse());

  const wrapperStyle: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    width: "100%",
    opacity: 0.1 * intensity,
    mixBlendMode: blendLayer ? "overlay" : undefined,
    pointerEvents: "none",
  };

  const gradientString = (dir: "top" | "bottom") =>
    `linear-gradient(
      to ${dir},
      ${color},
      rgba(255,255,255,0.2) 10%,
      rgba(255,255,255,0.1) 15%,
      rgba(255,255,255,0.3) 25%,
      transparent)`;

  const heightVal = (v: number) => Math.min(80 + v * 500, height / 2);

  return (
    <>
      {bars !== "bottom" && (
        <AbsoluteFill
          data-visualizer-bars="top"
          style={{ ...wrapperStyle, alignItems: "flex-start" }}
        >
          {mirrored.map((v, i) => (
            <div
              key={`bt${i}`}
              style={{
                background: gradientString("top"),
                width: 8,
                height: heightVal(v),
                mixBlendMode: blendLayer ? undefined : "overlay",
              }}
            />
          ))}
        </AbsoluteFill>
      )}
      {bars !== "top" && (
        <AbsoluteFill
          data-visualizer-bars="bottom"
          style={{ ...wrapperStyle, alignItems: "flex-end" }}
        >
          {mirrored.map((v, i) => (
            <div
              key={`bb${i}`}
              style={{
                background: gradientString("bottom"),
                width: 8,
                height: heightVal(v),
                mixBlendMode: blendLayer ? undefined : "overlay",
              }}
            />
          ))}
        </AbsoluteFill>
      )}
    </>
  );
};
