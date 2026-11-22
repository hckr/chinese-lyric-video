import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Lottie } from "@remotion/lottie";
import grinSweatData from "../../../public/grin-sweat.json";
import heartFaceData from "../../../public/heart-face.json";
import { LyricLine } from "../lyrics/LyricLine";
import { HeartBackground } from "./HeartBackground";

export type OutroProps = {
  /** Frame at which the dark overlay and first outro line appear. */
  outroStart: number;
  /** Frame at which the heart-tile background appears. */
  heartStart: number;
  /** Frame at which the first outro line ends (and the second begins). */
  firstLineEnd: number;
  /** Frame at which the second outro line begins. */
  secondLineStart: number;
  /** Total composition duration in frames (defaults to useVideoConfig().durationInFrames). */
  durationInFrames?: number;
};

const darkOverlayStyle: React.CSSProperties = { background: "rgba(0,0,0,0.5)" };

const lottieLeftStyle: React.CSSProperties = {
  position: "absolute",
  left: 450,
  bottom: 80,
  width: 100,
};

const lottieRightStyle: React.CSSProperties = {
  position: "absolute",
  right: 450,
  bottom: 80,
  width: 100,
};

const outroLine1: Parameters<typeof LyricLine>[0]["line"] = {
  id: "outro-1",
  words: [
    {
      hanzi: "感谢",
      pinyin: "gǎnxiè",
      translation: { en: "to thank\nto be grateful" },
    },
    {
      hanzi: "观看",
      pinyin: "guānkàn",
      translation: { en: "to watch\nto view" },
    },
  ],
  translation: {
    en: "Thank you for watching!".toUpperCase(),
    pl: "Dziękuję za obejrzenie!".toUpperCase(),
  },
};

const outroLine2: Parameters<typeof LyricLine>[0]["line"] = {
  id: "outro-2",
  words: [
    {
      hanzi: "请",
      pinyin: "qǐng",
      translation: { en: "please\nto ask" },
    },
    {
      hanzi: "点赞",
      pinyin: "diǎnzàn",
      translation: { en: "to like\n(on social media)" },
    },
    {
      hanzi: "并",
      pinyin: "bìng",
      translation: { en: "as well as\nalso" },
    },
    {
      hanzi: "订阅",
      pinyin: "dìngyuè",
      translation: { en: "to subscribe" },
    },
  ],
  translation: {
    en: "Please like and subscribe".toUpperCase(),
    pl: "Proszę polub i zasubskrybuj".toUpperCase(),
  },
};

/**
 * Keep Walking outro: dark overlay, heart-tile background, two lyric cards
 * with Lottie emoji animations. Used identically by LyricVideo and
 * LyricVideoOnlyPinin (which uses full-mode LyricLine for the outro text
 * regardless of the main composition mode).
 */
export const Outro: React.FC<OutroProps> = ({
  outroStart,
  heartStart,
  firstLineEnd,
  secondLineStart,
  durationInFrames: propDuration,
}) => {
  const videoConfig = useVideoConfig();
  const durationInFrames = propDuration ?? videoConfig.durationInFrames;
  return (
    <>
      <Sequence
        from={outroStart}
        durationInFrames={durationInFrames - outroStart}
      >
        <AbsoluteFill style={darkOverlayStyle} />
      </Sequence>

      <Sequence
        from={heartStart}
        durationInFrames={durationInFrames - heartStart}
      >
        <HeartBackground />
      </Sequence>

      <Sequence from={outroStart} durationInFrames={firstLineEnd - outroStart}>
        <LyricLine line={outroLine1} />
        <Lottie animationData={heartFaceData} style={lottieLeftStyle} />
        <Lottie animationData={heartFaceData} style={lottieRightStyle} />
      </Sequence>

      <Sequence
        from={secondLineStart}
        durationInFrames={durationInFrames - secondLineStart}
      >
        <LyricLine line={outroLine2} />
        <Lottie animationData={grinSweatData} style={lottieLeftStyle} />
        <Lottie animationData={grinSweatData} style={lottieRightStyle} />
      </Sequence>
    </>
  );
};
