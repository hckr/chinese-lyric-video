import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useRemotionEnvironment,
  useVideoConfig,
} from "remotion";
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

type LineData = {
  id: string;
  words: { hanzi: string; pinyin: string; translation: { en: string } }[];
  translation: { en: string; pl: string };
};

const LyricLine: React.FC<{ line: LineData }> = React.memo(({ line }) => (
  <>
    <AbsoluteFill style={styles.screenContainer}>
      <div style={styles.sentenceRow}>
        {line.words.map((word, wIndex) => (
          <div key={wIndex} style={styles.wordBlock}>
            <span style={styles.pinyin}>{word.pinyin}</span>
            <span style={styles.chinese}>{word.hanzi}</span>
            <span style={styles.wordTranslationEn}>{word.translation.en}</span>
          </div>
        ))}
      </div>
      <div style={styles.fullTranslationContainer}>
        <div style={styles.fullTranslationEn}>{line.translation.en}</div>
        <div style={styles.fullTranslationPl}>{line.translation.pl}</div>
      </div>
    </AbsoluteFill>
  </>
));

export const LyricVideo: React.FC = () => {
  const { isClientSideRendering } = useRemotionEnvironment();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "black" }}>
      <Sequence from={-1074}>
        {isClientSideRendering ? (
          <Video
            src={staticFile("Angela_Zhang_Keep_Walking.mp4")}
            style={{ width: "100%", height: "100%" }}
            objectFit="cover"
          />
        ) : (
          <OffthreadVideo
            src={staticFile("Angela_Zhang_Keep_Walking.mp4")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}

        {lyricsData.lines.map((line) => {
          const startFrame = Math.round((line.startMs / 1000) * fps);
          const endFrame = Math.round((line.endMs / 1000) * fps);

          // fallback for unset timing
          const duration =
            endFrame > startFrame ? endFrame - startFrame : Math.round(fps * 5);

          return (
            <Sequence
              key={line.id}
              from={startFrame}
              durationInFrames={duration}
            >
              <AbsoluteFill style={styles.backgroundContainer} />
              <LyricLine line={line} />
            </Sequence>
          );
        })}

        <div style={styles.watermark}>@SingInMandarin</div>
      </Sequence>
    </AbsoluteFill>
  );
};

const styles: Record<string, React.CSSProperties> = {
  backgroundContainer: {
    background: "rgba(0,0,0,0.5)",
  },
  screenContainer: {
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: "400px",
  },
  sentenceRow: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "32px",
    rowGap: "180px",
    padding: "0 100px",
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
    fontSize: "120px",
    fontWeight: "normal",
    color: "white",
    textShadow: heavyTextShadow("#111"),
    height: "70px",
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
    whiteSpace: "pre-wrap",
    textAlign: "center",
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
  watermark: {
    position: "absolute",
    top: "20px",
    right: "25px",
    fontFamily: lexendDecaFont,
    fontSize: "32px",
    fontWeight: 600,
    color: "#fff",
    textShadow: heavyTextShadow("#009c9f"),
    letterSpacing: "0.1em",
    opacity: 0.5,
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
