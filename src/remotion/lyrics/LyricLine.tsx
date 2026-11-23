import React from "react";
import { AbsoluteFill } from "remotion";
import {
  notoSansSCFont,
  interFont,
  lexendDecaFont,
  heavyTextShadow,
} from "../design/fonts";
import { LineData } from "./types";

export type LyricLineMode = "full" | "only-pinyin";
export type LyricLineVariant = "landscape" | "portrait";

type LyricLineProps = {
  line: LineData;
  layout?: import("../../../web/src/video/designs").Design["overrides"][string];
  showPinyin?: boolean;
  /**
   * "full"        — Pinyin above, Hanzi, per-word EN gloss, full EN+PL translation.
   *                 Used by LyricVideo, LyricVideoShort, LyricVideo2, and Outro.
   * "only-pinyin" — Larger Hanzi with Pinyin overlaid via hard-light blend; no gloss
   *                 or sentence translation. Used by LyricVideoOnlyPinin.
   */
  mode?: LyricLineMode;
  /**
   * "landscape" (default) — 1920×1080, paddingBottom 60px, chinese 150px.
   * "portrait"            — 1080×1920, paddingBottom 400px, chinese 120px,
   *                         wider sentenceRow gaps. Used by LyricVideoShort.
   */
  variant?: LyricLineVariant;
};

export const LyricLine: React.FC<LyricLineProps> = React.memo(
  ({
    line,
    layout,
    showPinyin = true,
    mode = "full",
    variant = "landscape",
  }) => {
    const isOnlyPinyin = mode === "only-pinyin";
    const isPortrait = variant === "portrait";

    const screenContainerStyle: React.CSSProperties = isOnlyPinyin
      ? { justifyContent: "center", alignItems: "center", isolation: "isolate" }
      : {
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: isPortrait ? "400px" : "60px",
        };

    const sentenceRowStyle: React.CSSProperties = {
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: isPortrait ? "32px" : "16px",
      ...(isPortrait ? { rowGap: "180px", padding: "0 100px" } : {}),
    };

    const wordBlockStyle: React.CSSProperties = {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-end",
      ...(isOnlyPinyin ? { position: "relative" } : {}),
    };

    // Chinese character size differs by mode and variant.
    const chineseStyle: React.CSSProperties = {
      fontSize: isOnlyPinyin ? "180px" : isPortrait ? "120px" : "150px",
      fontWeight: "normal",
      color: "white",
      textShadow: heavyTextShadow("#111"),
      height: isOnlyPinyin ? "100px" : isPortrait ? "70px" : "100px",
      display: "flex",
      alignItems: "center",
      fontFamily: notoSansSCFont,
    };

    return (
      <>
        <AbsoluteFill
          style={
            layout
              ? {
                  ...screenContainerStyle,
                  paddingInline:
                    layout.margin === undefined
                      ? undefined
                      : layout.margin + "%",
                  transform: `translateY(${layout.vertical}%) scale(${layout.scale})`,
                }
              : screenContainerStyle
          }
        >
          <div style={sentenceRowStyle}>
            {line.words
              .filter((word) => !isOnlyPinyin || word.hanzi)
              .map((word, wIndex) => (
                <div key={wIndex} style={wordBlockStyle}>
                  {isOnlyPinyin ? (
                    <>
                      {layout?.hanzi !== false && (
                        <span style={chineseStyle}>{word.hanzi}</span>
                      )}
                      <span style={pinyinOnlyPinyinStyle}>{word.pinyin}</span>
                    </>
                  ) : (
                    <>
                      {showPinyin && (
                        <span style={pinyinStyle}>{word.pinyin}</span>
                      )}
                      {layout?.hanzi !== false && (
                        <span style={chineseStyle}>{word.hanzi}</span>
                      )}
                      {layout?.gloss !== false && (
                        <span style={wordTranslationEnStyle}>
                          {word.translation.en}
                        </span>
                      )}
                    </>
                  )}
                </div>
              ))}
          </div>
          {!isOnlyPinyin && (
            <div style={fullTranslationContainerStyle}>
              {layout?.english !== false && (
                <div style={fullTranslationEnStyle}>{line.translation.en}</div>
              )}
              {layout?.polish !== false && (
                <div style={fullTranslationPlStyle}>{line.translation.pl}</div>
              )}
            </div>
          )}
        </AbsoluteFill>
      </>
    );
  },
);

// --- Static styles (not dependent on props) ---

const pinyinStyle: React.CSSProperties = {
  fontSize: "42px",
  letterSpacing: "5px",
  textShadow: heavyTextShadow("#995500"),
  color: "#ffcc00",
  marginBottom: "32px",
  fontFamily: interFont,
};

const pinyinOnlyPinyinStyle: React.CSSProperties = {
  fontSize: "65px",
  letterSpacing: "5px",
  color: "#ffcc00",
  textShadow: heavyTextShadow("magenta"),
  fontFamily: interFont,
  position: "absolute",
  mixBlendMode: "hard-light",
};

const wordTranslationEnStyle: React.CSSProperties = {
  fontSize: "42px",
  color: "#00eeff",
  textShadow: heavyTextShadow("#007788"),
  height: "40px",
  marginTop: "48px",
  fontFamily: interFont,
  whiteSpace: "pre-wrap",
  textAlign: "center",
};

const fullTranslationContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  marginTop: "230px",
  textAlign: "center",
};

const fullTranslationEnStyle: React.CSSProperties = {
  fontSize: "42px",
  color: "#eee",
  textShadow: heavyTextShadow("#00109f"),
  padding: "0 50px 8px",
  fontFamily: lexendDecaFont,
};

const fullTranslationPlStyle: React.CSSProperties = {
  fontSize: "42px",
  color: "#eee",
  textShadow: heavyTextShadow("#9f0b00"),
  marginTop: "8px",
  fontFamily: lexendDecaFont,
};
