import React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import lyricsData from "./Angela_Zhang_Keep_Walking";
import { loadFont as loadNotoSansSC } from "@remotion/google-fonts/NotoSansSC";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadLora } from "@remotion/google-fonts/Lora";

const { fontFamily: notoSansSCFont } = loadNotoSansSC("normal", {
  weights: ["400"],
});

const { fontFamily: interFont } = loadInter("normal", {
  weights: ["400"],
  subsets: ["latin", "latin-ext"],
});

const { fontFamily: loraFont } = loadLora("italic", {
  weights: ["400"],
  subsets: ["latin", "latin-ext"],
});

export const LyricVideo: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* 1. The Background Video */}
      <Video
        src={staticFile("Angela_Zhang_Keep_Walking.mp4")}
        style={{ width: "100%", height: "100%" }}
        objectFit="cover"
      />

      {/* 3. Map through the JSON lines */}
      {lyricsData.lines.map((line) => {
        // Convert the milliseconds from your JSON into exact video frames
        const startFrame = Math.round((line.startMs / 1000) * fps);
        const endFrame = Math.round((line.endMs / 1000) * fps);

        // Fallback for unset timing
        const duration =
          endFrame > startFrame ? endFrame - startFrame : Math.round(fps * 5);

        return (
          <Sequence key={line.id} from={startFrame} durationInFrames={duration}>
            <AbsoluteFill style={styles.gradientBackground} />
            <AbsoluteFill style={styles.screenContainer}>
              {/* The row containing the words */}
              <div style={styles.sentenceRow}>
                {line.words.map((word, wIndex) => (
                  <div key={wIndex} style={styles.wordBlock}>
                    {/* Pinyin on Top */}
                    <span style={styles.pinyin}>{word.pinyin}</span>

                    {/* Chinese Character in the Middle */}
                    <span style={styles.chinese}>{word.hanzi}</span>

                    <span style={styles.wordTranslationEn}>
                      {word.translation.en}
                    </span>
                    <span style={styles.wordTranslationPl}>
                      {word.translation.pl}
                    </span>
                  </div>
                ))}
              </div>

              {/*
              <div style={styles.fullTranslationContainer}>
                <div style={styles.fullTranslationEn}>
                  {line.translation.en}
                </div>
                <div style={styles.fullTranslationPl}>
                  {line.translation.pl}
                </div>
              </div>*/}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// --- STYLES ---
const styles: Record<string, React.CSSProperties> = {
  gradientBackground: {
    background:
      "linear-gradient(to top, rgba(0,0,0,0.0) 4%, rgba(0,0,0,0.5) 4%, rgba(0,0,0,0.5) 35%, rgba(0,0,0,0) 35%)",
  },
  screenContainer: {
    justifyContent: "flex-end", // Pushes text to the bottom
    alignItems: "center",
    paddingBottom: "80px", // Margin from bottom of video
  },
  sentenceRow: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "16px", // Space between each word block
  },
  wordBlock: {
    display: "flex",
    flexDirection: "column", // Stacks Pinyin -> Hanzi -> English
    alignItems: "center", // Centers them perfectly
    justifyContent: "flex-end",
  },
  pinyin: {
    fontSize: "32px",
    letterSpacing: "3px",
    textShadow:
      "1px 1px 1px black, -1px -1px 1px black, -1px 1px 1px black, 1px -1px 1px black",
    color: "#ffcc00", // Yellow
    marginBottom: "4px",
    fontFamily: interFont,
  },
  chinese: {
    fontSize: "92px",
    fontWeight: "normal",
    color: "#ffffff",
    textShadow:
      "1px 1px 1px black, -1px -1px 1px black, -1px 1px 1px black, 1px -1px 1px black",
    height: "100px",
    display: "flex",
    alignItems: "center",
    fontFamily: notoSansSCFont,
  },
  wordTranslationEn: {
    fontSize: "32px",
    color: "#00eeff",
    textShadow:
      "1px 1px 1px black, -1px -1px 1px black, -1px 1px 1px black, 1px -1px 1px black",
    height: "40px",
    marginTop: "24px",
    fontFamily: interFont,
  },
  wordTranslationPl: {
    fontSize: "32px",
    color: "#d6b4fc",
    textShadow:
      "1px 1px 1px black, -1px -1px 1px black, -1px 1px 1px black, 1px -1px 1px black",
    height: "40px",
    marginTop: "24px",
    fontFamily: interFont,
  },
  fullTranslationContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: "40px", // Space between word blocks and full translations
    textAlign: "center",
    width: "80%",
  },
  fullTranslationEn: {
    fontSize: "28px",
    color: "#eeeeee",
    fontStyle: "italic",
    textShadow: "1px 1px 4px rgba(0,0,0,0.8)",
    marginBottom: "6px",
    fontFamily: loraFont,
  },
  fullTranslationPl: {
    fontSize: "28px",
    color: "#aaaaaa", // Slightly darker/smaller to distinguish from EN
    textShadow: "1px 1px 4px rgba(0,0,0,0.8)",
    fontFamily: loraFont,
  },
};
