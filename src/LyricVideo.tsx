import React from "react";
import { staticFile } from "remotion";
import lyricsData from "./Angela_Zhang_Keep_Walking";
import { VideoLyricTemplate } from "./remotion/templates/VideoLyricTemplate";

// Consumer line data contract for renderer verification
type LineData = {
  id: string;
  words: { hanzi: string; pinyin: string; translation: { en: string } }[];
  translation: { en: string; pl: string };
};

export const LyricVideo: React.FC = () => (
  <VideoLyricTemplate
    lines={lyricsData.lines as ((typeof lyricsData.lines)[number] & LineData)[]}
    videoSrc={staticFile("Angela_Zhang_Keep_Walking.mp4")}
    lyricMode="full"
    variant="landscape"
    outro={{
      outroStart: 5015,
      heartStart: 5043,
      firstLineEnd: 5098,
      secondLineStart: 5098,
    }}
  />
);
