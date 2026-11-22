import React from "react";
import { VideoLyricTemplate } from "./VideoLyricTemplate";
import { ImageVisualizerTemplate } from "./ImageVisualizerTemplate";
import { UniversalLyricVideoProps } from "./types";

/**
 * Universal lyric video template that accepts either a video background or an
 * image + visualizer background via a discriminated union.
 */
export const LyricVideoTemplate: React.FC<UniversalLyricVideoProps> = ({
  background,
  ...commonProps
}) => {
  if (background.type === "video") {
    return (
      <VideoLyricTemplate videoSrc={background.videoSrc} {...commonProps} />
    );
  }

  return (
    <ImageVisualizerTemplate
      imageSrc={background.imageSrc}
      audioSrc={background.audioSrc}
      bassPulse={background.bassPulse}
      showVisualizer={background.showVisualizer}
      {...commonProps}
    />
  );
};
