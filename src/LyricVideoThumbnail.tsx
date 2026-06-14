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

// ─── Reused from LyricVideo ──────────────────────────────────────────────────
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

// ─── Song title data ──────────────────────────────────────────────────────────
const titleWords = [
  {
    hanzi: "淋雨",
    pinyin: "línyǔ",
    translation: "get wet in the rain",
  },
  {
    hanzi: "一直",
    pinyin: "yīzhí",
    translation: "continuously",
  },
  { hanzi: "走", pinyin: "zǒu", translation: "walk" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export const LyricVideoThumbnail: React.FC = () => {
  return (
    <AbsoluteFill style={styles.root}>
      <Img src={staticFile("thumbnail-bg-369.png")} style={styles.bgImage} />

      <AbsoluteFill style={styles.contentContainer}>
        <div style={styles.label}>
          Mandarin song lyrics
          <br />
          Pinyin · English · Polish
        </div>

        <div style={styles.sentenceRow}>
          {titleWords.map((word, i) => (
            <div key={i} style={styles.wordBlock}>
              <span style={styles.pinyin}>{word.pinyin}</span>
              <span style={styles.chinese}>{word.hanzi}</span>
              <span style={styles.wordTranslationEn}>{word.translation}</span>
            </div>
          ))}
        </div>

        <div style={styles.fullTranslationContainer}>
          <div style={styles.titleEn}>Keep Walking in the Rain</div>
          {/* <div style={styles.artist}>Angela Chang · 张韶涵 · Zhāng Sháohán</div> */}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    backgroundColor: "#000",
    overflow: "hidden",
  },

  bgImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0.45,
  },

  // Content layout
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
    color: "rgba(255,255,255,0.7)",
    letterSpacing: "3px",
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 20,
    textAlign: "center",
  },

  //  ── Word row (mirrors lyric video) ──
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

  // ── Full translation band ──
  fullTranslationContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },

  titleEn: {
    fontFamily: lexendDecaFont,
    fontSize: "90px",
    color: "#eee",
    textShadow: heavyTextShadow("#00109f"),
    letterSpacing: "6px",
    // marginBottom: 10,
  },

  artist: {
    fontFamily: lexendDecaFont,
    fontSize: "40px",
    color: "#eee",
    textShadow: heavyTextShadow("#9f0b00"),
    letterSpacing: "2px",
  },
};
