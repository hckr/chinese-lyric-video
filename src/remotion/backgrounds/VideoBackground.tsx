import React from "react";
import { OffthreadVideo, staticFile, useRemotionEnvironment } from "remotion";
import { Video } from "@remotion/media";

type VideoBackgroundProps = {
  /** Full asset URL, e.g. the result of staticFile("..."). */
  src: string;
};

/**
 * Renders the footage as Video (client-side) or OffthreadVideo (server-side),
 * matching the pattern used by all three footage compositions.
 */
export const VideoBackground: React.FC<VideoBackgroundProps> = ({ src }) => {
  const { isClientSideRendering } = useRemotionEnvironment();
  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };
  return isClientSideRendering ? (
    <Video src={src} style={style} objectFit="cover" />
  ) : (
    <OffthreadVideo src={src} style={style} />
  );
};

// Re-export for callers that want to pass the result of staticFile() inline.
export { staticFile };
