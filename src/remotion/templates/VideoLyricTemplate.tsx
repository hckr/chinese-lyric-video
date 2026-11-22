import React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { LyricLine } from "../lyrics/LyricLine";
import { msToFrameDuration } from "../lyrics/timing";
import { VideoBackground } from "../backgrounds/VideoBackground";
import { Outro } from "../overlays/Outro";
import { Watermark } from "../overlays/Watermark";
import { VideoLyricTemplateProps } from "./types";
import defaultSongData from "../../Angela_Zhang_Keep_Walking";

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
 * Reusable video footage template based on LyricVideo.
 * Standard parameters: lines, videoSrc, lyricMode ("full" | "only-pinyin"),
 * variant ("landscape" | "short"), optional sequenceOffset, watermark, and outro.
 */
export const VideoLyricTemplate: React.FC<VideoLyricTemplateProps> = ({
  lines = defaultSongData.lines,
  videoSrc = "Angela_Zhang_Keep_Walking.mp4",
  lyricMode = "full",
  variant = "landscape",
  sequenceOffset = 0,
  showWatermark = true,
  watermarkText = "@SingInMandarin",
  showDimOverlay = true,
  outro,
}) => {
  const { fps } = useVideoConfig();
  const effectiveLines =
    lines && lines.length > 0 ? lines : defaultSongData.lines;
  const resolvedVideoSrc = resolveAsset(videoSrc);

  const content = (
    <>
      <VideoBackground src={resolvedVideoSrc} />

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

      {outro && (
        <Outro
          outroStart={outro.outroStart}
          heartStart={outro.heartStart}
          firstLineEnd={outro.firstLineEnd}
          secondLineStart={outro.secondLineStart}
          durationInFrames={outro.durationInFrames}
        />
      )}

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
