import React, { CSSProperties } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useRemotionEnvironment,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import lyricsData from "./Macchiato_Special_Affection_for_You";
import { loadFont as loadNotoSansSC } from "@remotion/google-fonts/NotoSansSC";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadLexendDeca } from "@remotion/google-fonts/LexendDeca";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";

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

const Visualizer: React.FC<{ audioData: ReturnType<typeof useAudioData> }> = ({
  audioData,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!audioData) return null;

  const logScale = (v: number, floor = 0.001) => {
    const clamped = Math.max(v, floor);
    return (Math.log(clamped) - Math.log(floor)) / (0 - Math.log(floor));
  };

  const SMOOTHING_FRAMES = 7;
  const DECAY = 0.5;
  const numberOfSamples = 64;

  const smoothed = new Array(numberOfSamples).fill(0);
  let totalWeight = 0;

  for (let back = 0; back < SMOOTHING_FRAMES; back++) {
    const sampleFrame = Math.max(0, frame - back);
    const weight = Math.pow(DECAY, back);

    const raw = visualizeAudio({
      fps,
      frame: sampleFrame,
      audioData,
      numberOfSamples,
    });

    raw.forEach((v, i) => {
      smoothed[i] += logScale(v) * weight;
    });

    totalWeight += weight;
  }

  const boosted = smoothed.map((v) => v / totalWeight);
  const mirrored = boosted.concat([...boosted].reverse());

  const wrapperStyle: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    width: "100%",
  };

  const gradientString = (dir: "top" | "bottom") =>
    `linear-gradient(
      to ${dir},
      white,
      rgba(255,255,255,0.5) 10%,
      rgba(255,255,255,0.3) 15%,
      rgba(255,255,255,0.2) 25%,
      transparent)`;

  const heightVal = (v: number) => Math.min(50 + v * 570, 1080 / 2);

  return (
    <>
      <AbsoluteFill style={{ ...wrapperStyle, alignItems: "flex-start" }}>
        {mirrored.map((v, i) => (
          <div
            key={`bt${i}`}
            style={{
              background: gradientString("top"),
              width: 8,
              height: heightVal(v),
              mixBlendMode: "overlay",
            }}
          />
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ ...wrapperStyle, alignItems: "flex-end" }}>
        {mirrored.map((v, i) => (
          <div
            key={`bb${i}`}
            style={{
              background: gradientString("bottom"),
              width: 8,
              height: heightVal(v),
              mixBlendMode: "overlay",
            }}
          />
        ))}
      </AbsoluteFill>
    </>
  );
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

export const LyricVideo2: React.FC = () => {
  const { isClientSideRendering } = useRemotionEnvironment();
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const fileName = "Macchiato_Special_Affection_for_You.mp4";
  const audioData = useAudioData(staticFile(fileName));

  // --- heartbeat pulse from bass frequencies ---
  const DECAY_FRAMES = 8;
  const BASS_BINS = 6;
  let peakValue = 0;
  let peakAge = 0;

  if (audioData) {
    for (let back = 0; back < DECAY_FRAMES; back++) {
      const sampleFrame = Math.max(0, frame - back);
      const raw = visualizeAudio({
        fps,
        frame: sampleFrame,
        audioData,
        numberOfSamples: 64,
      });

      const bassValue =
        raw.slice(0, BASS_BINS).reduce((sum, v) => sum + v, 0) / BASS_BINS;

      if (bassValue > peakValue) {
        peakValue = bassValue;
        peakAge = back;
      }
    }
  }

  const pulse = peakValue * Math.pow(0.6, peakAge);
  const scale = 1 + pulse * 0.03;
  const blur = pulse * 10;

  const videoStyle: React.CSSProperties = {
    width: "110%",
    position: "relative",
    top: "-59%",
    left: "-5%",
    transform: `scale(${scale})`,
    transformOrigin: "center center",
    filter: `blur(${blur}px)`,
  };

  return (
    <AbsoluteFill style={{ background: "black" }}>
      {isClientSideRendering ? (
        <Video
          src={staticFile(fileName)}
          style={videoStyle}
          objectFit="cover"
        />
      ) : (
        <OffthreadVideo
          src={staticFile(fileName)}
          style={{ ...videoStyle, objectFit: "cover" }}
        />
      )}

      <Visualizer audioData={audioData} />

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
