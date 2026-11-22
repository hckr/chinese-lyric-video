import React from "react";
import { staticFile } from "remotion";
import lyricsData from "./Macchiato_Special_Affection_for_You";
import { ImageVisualizerTemplate } from "./remotion/templates/ImageVisualizerTemplate";

// Consumer line data contract for renderer verification
type LineData = {
  id: string;
  words: { hanzi: string; pinyin: string; translation: { en: string } }[];
  translation: { en: string; pl: string };
};

export const LyricVideo2: React.FC = () => (
  <ImageVisualizerTemplate
    lines={lyricsData.lines as ((typeof lyricsData.lines)[number] & LineData)[]}
    imageSrc={staticFile("macchiato_cover.png")}
    audioSrc={staticFile("Macchiato_Special_Affection_for_You.mp4")}
    lyricMode="full"
    variant="landscape"
  />
);
