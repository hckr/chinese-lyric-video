import React from "react";
import { AbsoluteFill, staticFile, Img } from "remotion";
import {
  notoSansSCFont,
  interFont,
  lexendDecaFont,
  heavyTextShadow,
  heavyTextShadow2,
} from "../design/fonts";
import { ThumbnailTemplateProps } from "./types";

function resolveAsset(src: string): string {
  if (
    src.startsWith("blob:") ||
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("/")
  ) {
    return src;
  }
  return staticFile(src);
}

const defaultTitleWords = [
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

/**
 * Reusable Thumbnail template unifying Thumbnail, ThumbnailOnlyPinyin,
 * and Thumbnail2 with configurable background, titles, words, and modes:
 * - "full": top label, title words with Pinyin & English gloss, English title.
 * - "only-pinyin": top label, title words with large Chinese and blended Pinyin, bottom label.
 * - "title-only": large English title, subtitle label.
 */
export const ThumbnailTemplate: React.FC<ThumbnailTemplateProps> = ({
  mode = "full",
  bgImageSrc,
  bgImageOpacity,
  musicNotesWatermark,
  musicNotesStyle,
  topLabel,
  bottomLabel,
  titleEn,
  titleWords = defaultTitleWords,
}) => {
  const isOnlyPinyin = mode === "only-pinyin";
  const isTitleOnly = mode === "title-only";

  const effectiveBgImageSrc =
    bgImageSrc ??
    (isTitleOnly
      ? "vlcsnap-2026-06-20-20h55m06s209.png"
      : "thumbnail-bg-369.png");
  const resolvedBg = resolveAsset(effectiveBgImageSrc);

  const effectiveOpacity =
    bgImageOpacity !== undefined ? bgImageOpacity : isTitleOnly ? 0.9 : 0.6;

  const effectiveMusicNotesWatermark =
    musicNotesWatermark ?? (isTitleOnly ? "♪♪♪♪" : "♪♬");

  const effectiveMusicNotesStyle: React.CSSProperties = {
    ...(isTitleOnly
      ? {
          marginTop: -340,
          marginLeft: -120,
          letterSpacing: "-150px",
          fontStyle: "italic",
          paddingTop: 40,
        }
      : undefined),
    ...musicNotesStyle,
  };

  const effectiveTopLabel =
    topLabel ??
    (isOnlyPinyin
      ? "Mandarin song lyrics"
      : "Mandarin song lyrics\nPinyin · English · Polish");

  const effectiveBottomLabel = bottomLabel ?? "characters with pinyin";

  const effectiveTitleEn =
    titleEn ?? (isTitleOnly ? "Keep Walking" : "Keep Walking in the Rain");

  return (
    <AbsoluteFill style={styles.root}>
      <Img
        src={resolvedBg}
        style={{
          ...styles.bgImage,
          opacity: effectiveOpacity,
          ...(isTitleOnly ? { position: "relative" } : {}),
        }}
      />

      <AbsoluteFill
        style={{ ...styles.emojiBackground, ...effectiveMusicNotesStyle }}
      >
        {effectiveMusicNotesWatermark}
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          ...styles.contentContainer,
          gap: isOnlyPinyin ? "80px" : "0px",
        }}
      >
        {/* Title-Only mode puts title first, then label */}
        {isTitleOnly ? (
          <>
            <div style={styles.fullTranslationContainer}>
              <div style={styles.titleEnBig}>{effectiveTitleEn}</div>
            </div>
            <div style={{ ...styles.label, marginTop: 120, marginBottom: 0 }}>
              {effectiveTopLabel.split("\n").map((text, idx, arr) => (
                <React.Fragment key={idx}>
                  {text}
                  {idx < arr.length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={styles.label}>
              {effectiveTopLabel.split("\n").map((text, idx, arr) => (
                <React.Fragment key={idx}>
                  {text}
                  {idx < arr.length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>

            <div
              style={{
                ...styles.sentenceRow,
                ...(isOnlyPinyin ? { position: "relative" } : {}),
              }}
            >
              {titleWords.map((word, i) => (
                <div key={i} style={styles.wordBlock}>
                  {isOnlyPinyin ? (
                    <>
                      <span style={styles.chineseOnlyPinyin}>{word.hanzi}</span>
                      <span style={styles.pinyinOnlyPinyin}>{word.pinyin}</span>
                    </>
                  ) : (
                    <>
                      <span style={styles.pinyin}>{word.pinyin}</span>
                      <span style={styles.chinese}>{word.hanzi}</span>
                      {word.translation && (
                        <span style={styles.wordTranslationEn}>
                          {word.translation}
                        </span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {isOnlyPinyin ? (
              <div style={styles.label}>{effectiveBottomLabel}</div>
            ) : (
              <div style={styles.fullTranslationContainer}>
                <div style={styles.titleEn}>{effectiveTitleEn}</div>
              </div>
            )}
          </>
        )}
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

  titleEnBig: {
    fontFamily: lexendDecaFont,
    fontSize: "150px",
    color: "#d4a2ff",
    textShadow: heavyTextShadow2("#9f007a"),
    letterSpacing: "10px",
    marginTop: 20,
  },
};
