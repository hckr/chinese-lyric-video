import React from "react";
import {
  AbsoluteFill,
  Html5Audio,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { LyricLine } from "../lyrics/LyricLine";
import { msToFrameDuration } from "../lyrics/timing";
import { Visualizer } from "../visualizers/Visualizer";
import { Watermark } from "../overlays/Watermark";
import { ImageVisualizerTemplateProps } from "./types";
import defaultSongData from "../../Macchiato_Special_Affection_for_You";

const darkOverlay: React.CSSProperties = { background: "rgba(0,0,0,0.5)" };

function resolveAsset(src: string): string {
  if (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("/")
  ) {
    return src;
  }
  return staticFile(src);
}

/**
 * Reusable image + visualizer template based on LyricVideo2.
 * Standard parameters: lines, imageSrc, audioSrc, lyricMode ("full" | "only-pinyin"),
 * variant ("landscape" | "short"), optional bassPulse, showVisualizer, and watermark.
 */
export const ImageVisualizerTemplate: React.FC<
  ImageVisualizerTemplateProps
> = ({
  lines = defaultSongData.lines,
  imageSrc = "macchiato_cover.png",
  audioSrc = "Macchiato_Special_Affection_for_You.mp4",
  lyricMode = "full",
  variant = "landscape",
  sequenceOffset = 0,
  showWatermark = true,
  watermarkText = "@SingInMandarin",
  showDimOverlay = false,
  bassPulse = true,
  showVisualizer = true,
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const effectiveLines =
    lines && lines.length > 0 ? lines : defaultSongData.lines;
  const resolvedImageSrc = resolveAsset(imageSrc);
  const resolvedAudioSrc = resolveAsset(audioSrc);

  const audioData = useAudioData(resolvedAudioSrc);

  // --- Heartbeat pulse derived from bass frequencies ---
  const DECAY_FRAMES = 5;
  const BASS_BINS = 3;
  let peakValue = 0;
  let peakAge = 0;

  if (bassPulse && audioData) {
    for (let back = 0; back < DECAY_FRAMES; back++) {
      const sampleFrame = Math.max(0, frame - back);
      const raw = visualizeAudio({
        fps,
        frame: sampleFrame,
        audioData,
        numberOfSamples: 64,
      });

      const bassValue =
        raw.slice(0, BASS_BINS).reduce((sum, v) => sum + v, 0) / BASS_BINS;

      if (bassValue > peakValue) {
        peakValue = bassValue;
        peakAge = back;
      }
    }
  }

  const pulse = peakValue * Math.pow(0.6, peakAge);
  const scale = 1 + pulse * 0.03;
  const blur = pulse * 10;

  const content = (
    <>
      <Html5Audio src={resolvedAudioSrc} />

      <Img
        src={resolvedImageSrc}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: bassPulse ? `scale(${scale})` : undefined,
          transformOrigin: "center center",
          filter: bassPulse && blur > 0 ? `blur(${blur}px)` : undefined,
        }}
      />

      {/* First Visualizer pass */}
      {showVisualizer && <Visualizer audioData={audioData} />}

      {effectiveLines.map((line) => {
        const { startFrame, duration } = msToFrameDuration(
          line.startMs,
          line.endMs,
          fps,
        );
        return (
          <Sequence key={line.id} from={startFrame} durationInFrames={duration}>
            {showDimOverlay && <AbsoluteFill style={darkOverlay} />}
            <LyricLine
              line={line}
              mode={lyricMode}
              variant={variant === "short" ? "portrait" : "landscape"}
            />
          </Sequence>
        );
      })}

      {/* Second Visualizer pass — intentional double-render for blend effect */}
      {showVisualizer && <Visualizer audioData={audioData} />}

      {showWatermark && <Watermark text={watermarkText} />}
    </>
  );

  return (
    <AbsoluteFill style={{ background: "black" }}>
      {sequenceOffset !== 0 ? (
        <Sequence from={sequenceOffset}>{content}</Sequence>
      ) : (
        content
      )}
    </AbsoluteFill>
  );
};
