import React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import lyricsData from "./Angela_Zhang_Keep_Walking";
import { loadFont as loadNotoSansSC } from "@remotion/google-fonts/NotoSansSC";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadLexendDeca } from "@remotion/google-fonts/LexendDeca";

const { fontFamily: notoSansSCFont } = loadNotoSansSC("normal", {
  weights: ["400"],
});

const { fontFamily: interFont } = loadInter("normal", {
  weights: ["400"],
  subsets: ["latin", "latin-ext"],
});

const { fontFamily: lexendDecaFont } = loadLexendDeca("normal", {
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
                  </div>
                ))}
              </div>

              <div style={styles.fullTranslationContainer}>
                <div style={styles.fullTranslationEn}>
                  {line.translation.en}
                </div>
                <div style={styles.fullTranslationPl}>
                  {line.translation.pl}
                </div>
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const styles: Record<string, React.CSSProperties> = {
  gradientBackground: {
    background: "rgba(0,0,0,0.5)",
    // background: `linear-gradient(to top, rgba(0,0,0,0.0) 19%, rgba(0,0,0,0.5) 19%, rgba(0,0,0,0.5) 41.4%, rgba(0,0,0,0) 41.4%)`,
    //    linear-gradient(to top, rgba(0,0,0,0.0) 4%, rgba(0,0,0,0.5) 4%, rgba(0,0,0,0.5) 16%, rgba(0,0,0,0) 16%)`,
  },
  screenContainer: {
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: "60px",
  },
  sentenceRow: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "16px",
  },
  wordBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  pinyin: {
    fontSize: "42px",
    letterSpacing: "5px",
    textShadow: heavyTextShadow("#995500"),
    color: "#ffcc00",
    marginBottom: "32px",
    fontFamily: interFont,
  },
  chinese: {
    fontSize: "150px",
    fontWeight: "normal",
    color: "white",
    textShadow: heavyTextShadow("#111"),
    height: "100px",
    display: "flex",
    alignItems: "center",
    fontFamily: notoSansSCFont,
  },
  wordTranslationEn: {
    fontSize: "42px",
    color: "#00eeff",
    textShadow: heavyTextShadow("#007788"),
    height: "40px",
    marginTop: "48px",
    fontFamily: interFont,
  },
  fullTranslationContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: "230px",
    textAlign: "center",
  },
  fullTranslationEn: {
    fontSize: "42px",
    color: "#eee",
    textShadow: heavyTextShadow("#00109f"),
    padding: "0 50px 8px",
    fontFamily: lexendDecaFont,
  },
  fullTranslationPl: {
    fontSize: "42px",
    color: "#eee",
    textShadow: heavyTextShadow("#9f0b00"),
    marginTop: "8px",
    fontFamily: lexendDecaFont,
  },
};

function heavyTextShadow(color: string) {
  return (
    `1px 1px 3px ${color}, -1px -1px 3px ${color}, -1px 1px 3px ${color}, 1px -1px 3px ${color},` +
    `1px 1px 3px ${color}, -1px -1px 3px ${color}, -1px 1px 3px ${color}, 1px -1px 3px ${color},` +
    `1px 1px 3px ${color}, -1px -1px 3px ${color}, -1px 1px 3px ${color}, 1px -1px 3px ${color},` +
    `1px 1px 2px ${color}, -1px -1px 2px ${color}, -1px 1px 2px ${color}, 1px -1px 2px ${color},` +
    `1px 1px 2px ${color}, -1px -1px 2px ${color}, -1px 1px 2px ${color}, 1px -1px 2px ${color},` +
    `1px 1px 1px ${color}, -1px -1px 1px ${color}, -1px 1px 1px ${color}, 1px -1px 1px ${color}`
  );
}
