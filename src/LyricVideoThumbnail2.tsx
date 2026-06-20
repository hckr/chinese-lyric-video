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

export const LyricVideoThumbnail2: React.FC = () => {
  return (
    <AbsoluteFill style={styles.root}>
      <Img
        src={staticFile("vlcsnap-2026-06-20-20h55m06s209.png")}
        style={styles.bgImage}
      />

      <AbsoluteFill style={styles.emojiBackground}>♪♪♪♪</AbsoluteFill>

      <AbsoluteFill style={styles.contentContainer}>
        {/* <div style={styles.sentenceRow}>
          {titleWords.map((word, i) => (
            <div key={i} style={styles.wordBlock}>
              <span style={styles.pinyin}>{word.pinyin}</span>
              <span style={styles.chinese}>{word.hanzi}</span>
              <span style={styles.wordTranslationEn}>{word.translation}</span>
            </div>
          ))}
        </div> */}
        <div style={styles.fullTranslationContainer}>
          <div style={styles.titleEn}>Keep Walking</div>
        </div>
        <div style={styles.label}>
          Mandarin song lyrics
          <br />
          Pinyin · English · Polish
        </div>
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
    opacity: 0.9,
    position: "relative",
    // left: "-42%",
  },

  emojiBackground: {
    color: "white",
    opacity: 0.2,
    fontSize: 900,
    textAlign: "center",
    marginTop: -340,
    marginLeft: -120,
    letterSpacing: "-150px",
    fontStyle: "italic",
    paddingTop: 40,
  },

  contentContainer: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "0px",
    paddingBottom: "30px",
  },

  label: {
    fontFamily: lexendDecaFont,
    fontSize: "80px",
    color: "rgba(255, 255, 255, 0.7)",
    textShadow: heavyTextShadow2("#00998f"),
    letterSpacing: "3px",
    textTransform: "uppercase",
    marginTop: 120,
    // marginBottom: 20,
    textAlign: "center",
  },

  sentenceRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    gap: "28px",
    marginBottom: "28px",
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
    fontSize: "150px",
    color: "#d4a2ff",
    textShadow: heavyTextShadow2("#9f007a"),
    letterSpacing: "10px",
    marginTop: 20,
  },
};
