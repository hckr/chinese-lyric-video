import React from "react";
import { AbsoluteFill, staticFile, Img } from "remotion";
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

function heavyTextShadow2(color: string) {
  return (
    `2px 2px 3px ${color}, -2px -2px 3px ${color}, -2px 2px 3px ${color}, 2px -2px 3px ${color},` +
    `2px 2px 3px ${color}, -2px -2px 3px ${color}, -2px 2px 3px ${color}, 2px -2px 3px ${color},` +
    `2px 2px 3px ${color}, -2px -2px 3px ${color}, -2px 2px 3px ${color}, 2px -2px 3px ${color},` +
    `1px 1px 2px ${color}, -1px -1px 2px ${color}, -1px 1px 2px ${color}, 1px -1px 2px ${color},` +
    `1px 1px 2px ${color}, -1px -1px 2px ${color}, -1px 1px 2px ${color}, 1px -1px 2px ${color},` +
    `1px 1px 1px ${color}, -1px -1px 1px ${color}, -1px 1px 1px ${color}, 1px -1px 1px ${color}`
  );
}

const titleWords = [
  {
    hanzi: "淋雨",
    pinyin: "línyǔ",
    translation: "to get wet in the rain",
  },
  {
    hanzi: "一直",
    pinyin: "yīzhí",
    translation: "continuously",
  },
  { hanzi: "走", pinyin: "zǒu", translation: "to walk" },
];

export const LyricVideoThumbnail: React.FC = () => {
  return (
    <AbsoluteFill style={styles.root}>
      <Img src={staticFile("thumbnail-bg-369.png")} style={styles.bgImage} />

      <AbsoluteFill style={styles.emojiBackground}>♪♬</AbsoluteFill>

      <AbsoluteFill style={styles.contentContainer}>
        <div style={styles.label}>Mandarin song lyrics</div>

        <div style={styles.sentenceRow}>
          {titleWords.map((word, i) => (
            <div key={i} style={styles.wordBlock}>
              <span style={styles.chineseOnlyPinyin}>{word.hanzi}</span>
              <span style={styles.pinyinOnlyPinyin}>{word.pinyin}</span>
            </div>
          ))}
        </div>

        <div style={styles.label}>characters with pinyin</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    backgroundColor: "black",
    overflow: "hidden",
  },

  bgImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0.6,
  },

  emojiBackground: {
    color: "white",
    opacity: 0.2,
    fontSize: 900,
    textAlign: "center",
    marginTop: -350,
    marginLeft: 0,
  },

  contentContainer: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "80px",
    paddingBottom: "30px",
  },

  label: {
    fontFamily: lexendDecaFont,
    fontSize: "80px",
    color: "rgba(255, 255, 255, 0.7)",
    textShadow: heavyTextShadow2("#00998f"),
    letterSpacing: "3px",
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 20,
    textAlign: "center",
  },

  sentenceRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    gap: "28px",
    marginBottom: "28px",
    position: "relative",
  },

  wordBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  pinyin: {
    fontFamily: interFont,
    fontSize: "48px",
    letterSpacing: "2px",
    color: "#ffcc00",
    textShadow: heavyTextShadow("#995500"),
    marginBottom: "10px",
  },

  pinyinOnlyPinyin: {
    fontSize: "95px",
    letterSpacing: "5px",
    color: "#ffcc00",
    textShadow: heavyTextShadow("magenta"),
    fontFamily: interFont,
    position: "absolute",
    top: "50%",
    marginTop: -47,
    mixBlendMode: "hard-light",
  },

  chinese: {
    fontFamily: notoSansSCFont,
    fontSize: "180px",
    fontWeight: "normal",
    color: "white",
    textShadow: heavyTextShadow("#111"),
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
  },

  chineseOnlyPinyin: {
    fontSize: "220px",
    fontWeight: "normal",
    color: "white",
    textShadow: heavyTextShadow("#111"),
    height: "100px",
    display: "flex",
    alignItems: "center",
    fontFamily: notoSansSCFont,
  },

  wordTranslationEn: {
    fontFamily: interFont,
    fontSize: "42px",
    color: "#00eeff",
    textShadow: heavyTextShadow("#007788"),
    marginTop: "20px",
    whiteSpace: "pre-wrap",
    textAlign: "center",
  },

  fullTranslationContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },

  titleEn: {
    fontFamily: lexendDecaFont,
    fontSize: "90px",
    color: "#d4a2ff",
    textShadow: heavyTextShadow2("#9f007a"),
    letterSpacing: "6px",
  },
};
