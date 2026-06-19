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
import { AnimatedEmoji } from "@remotion/animated-emoji";

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

const HeartBackground: React.FC = () => {
  const { width, height } = useVideoConfig();

  const HEART_SIZE = 30;
  const cells = React.useMemo(() => {
    const cols = Math.ceil(width / HEART_SIZE);
    const rows = Math.ceil(height / HEART_SIZE);
    return Array.from({ length: rows * cols }, (_, i) => ({
      row: Math.floor(i / cols),
      col: i % cols,
    }));
  }, [width, height]);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {cells.map(({ row, col }) => (
        <div
          key={`${row}-${col}`}
          style={{
            position: "absolute",
            left: col * HEART_SIZE,
            top: row * HEART_SIZE,
            width: HEART_SIZE,
            height: HEART_SIZE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "36px",
            opacity: 0.15,
          }}
        >
          <svg viewBox="0 0 100 100">
            <path
              d="M50 88 C20 65, 5 50, 5 33 C5 18, 17 8, 30 8 C38 8, 45 12, 50 18 C55 12, 62 8, 70 8 C83 8, 95 18, 95 33 C95 50, 80 65, 50 88Z"
              fill="#dd3b43"
            />
          </svg>
        </div>
      ))}
    </AbsoluteFill>
  );
};

export const LyricVideo: React.FC = () => {
  const { isClientSideRendering } = useRemotionEnvironment();
  const { fps, durationInFrames } = useVideoConfig();

  const OUTRO_START = 5043;
  const FIRST_LINE_END = 5097;
  const SECOND_LINE_START = 5100;
  const HEART_START = 5043;

  return (
    <AbsoluteFill style={{ background: "black" }}>
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
          <Sequence key={line.id} from={startFrame} durationInFrames={duration}>
            <AbsoluteFill style={styles.backgroundContainer} />
            <LyricLine line={line} />
          </Sequence>
        );
      })}

      <Sequence
        from={OUTRO_START}
        durationInFrames={durationInFrames - OUTRO_START}
      >
        <AbsoluteFill style={styles.backgroundContainer} />
      </Sequence>

      <Sequence
        from={HEART_START}
        durationInFrames={durationInFrames - HEART_START}
      >
        <HeartBackground />
      </Sequence>

      <Sequence
        from={OUTRO_START}
        durationInFrames={FIRST_LINE_END - OUTRO_START}
      >
        <LyricLine
          line={{
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
          }}
        />
        {!isClientSideRendering && (
          <>
            <AnimatedEmoji
              emoji="heart-face"
              scale="0.5"
              style={{
                position: "absolute",
                left: 450,
                bottom: 80,
                width: 100,
              }}
            />
            <AnimatedEmoji
              emoji="heart-face"
              scale="0.5"
              style={{
                position: "absolute",
                right: 450,
                bottom: 80,
                width: 100,
              }}
            />
          </>
        )}
      </Sequence>

      <Sequence
        from={SECOND_LINE_START}
        durationInFrames={durationInFrames - SECOND_LINE_START}
      >
        <LyricLine
          line={{
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
          }}
        />
        <AnimatedEmoji
          emoji="grin-sweat"
          scale="0.5"
          style={{ position: "absolute", left: 450, bottom: 80, width: 100 }}
        />
        <AnimatedEmoji
          emoji="grin-sweat"
          scale="0.5"
          style={{ position: "absolute", right: 450, bottom: 80, width: 100 }}
        />
      </Sequence>

      <div style={styles.watermark}>@SingInMandarin</div>
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
    color: "#ccc",
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
