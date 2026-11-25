import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AbsoluteFill,
  Freeze,
  Html5Audio,
  Html5Video,
  Img,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  useRemotionEnvironment,
  useDelayRender,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import {
  useAudioData,
  useWindowedAudioData,
  visualizeAudio,
} from "@remotion/media-utils";
import { Input, UrlSource, ALL_FORMATS, CanvasSink } from "mediabunny";
import type { Design } from "../../../web/src/video/designs";
import { Visualizer } from "../visualizers/Visualizer";
import { loopFrame } from "./loop-frame";

function LoopClip({ src, design }: { src: string; design: Design }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const { isRendering } = useRemotionEnvironment();
  const [error, setError] = useState<Error>();
  const fail = useCallback(
    (reason: unknown) => {
      const error = new Error(
        "Loop clip could not be decoded. Relink a compatible video. " +
          String(reason),
      );
      if (isRendering) cancelRender(error);
      else setError(error);
    },
    [isRendering, cancelRender],
  );
  const [sink, setSink] = useState<{
    src: string;
    sink: CanvasSink;
    first: number;
  }>();
  useEffect(() => {
    let active = true;
    const hold = delayRender("Opening loop clip");
    const input = new Input({
      source: new UrlSource(src),
      formats: ALL_FORMATS,
    });
    void input
      .getPrimaryVideoTrack()
      .then(async (track) => {
        if (!active) return;
        if (!track) throw Error("Clip has no video track");
        const first = Math.max(0, await track.getFirstTimestamp());
        if (active) setSink({ src, sink: new CanvasSink(track), first });
      })
      .catch((e) => {
        if (active) fail(e);
      })
      .finally(() => continueRender(hold));
    return () => {
      active = false;
      input.dispose();
    };
  }, [src, delayRender, continueRender, fail]);
  const length = Math.max(
    1,
    Math.ceil(
      (((design.endMs ?? design.asset?.durationMs ?? 0) - design.startMs) *
        fps) /
        1000,
    ),
  );
  const time =
    design.startMs / 1000 +
    loopFrame(Math.floor(frame * design.speed), length, design.loop) / fps;
  useLayoutEffect(() => {
    if (sink?.src !== src) return;
    let active = true;
    const hold = delayRender("Decoding loop frame");
    void sink.sink
      .getCanvas(sink.first + time)
      .then((sample) => {
        if (!active || !canvas.current) return;
        if (!sample) throw Error("Could not decode loop frame at " + time);
        const c = canvas.current;
        c.width = sample.canvas.width;
        c.height = sample.canvas.height;
        c.getContext("2d")!.drawImage(sample.canvas, 0, 0);
      })
      .catch((e) => {
        if (active) fail(e);
      })
      .finally(() => continueRender(hold));
    return () => {
      active = false;
    };
  }, [sink, src, time, delayRender, continueRender, fail]);
  if (error) throw error;
  return (
    <canvas
      ref={canvas}
      style={{ width: "100%", height: "100%", objectFit: design.fit }}
    />
  );
}
type EffectsProps = {
  design: Design;
  children: React.ReactNode;
  lyrics: React.ReactNode;
};

function PreviewEffects({
  audioSrc,
  ...props
}: EffectsProps & { audioSrc: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audio = useWindowedAudioData({
    src: audioSrc,
    frame,
    fps,
    windowInSeconds: 5,
  });
  return <Effects {...props} {...audio} blendLayer />;
}

function RenderEffects({
  audioSrc,
  ...props
}: EffectsProps & { audioSrc: string }) {
  const audioData = useAudioData(audioSrc);
  return <Effects {...props} audioData={audioData} />;
}

function Effects({
  audioData,
  dataOffsetInSeconds = 0,
  blendLayer = false,
  design,
  children,
  lyrics,
}: EffectsProps & {
  audioData: ReturnType<typeof useAudioData>;
  dataOffsetInSeconds?: number;
  blendLayer?: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let peak = 0;
  let peakAge = 0;
  if (audioData && design.bassPulse)
    for (let age = 0; age < 5; age++) {
      const bins = visualizeAudio({
        audioData,
        frame: Math.max(frame - age, 0),
        fps,
        numberOfSamples: 64,
        dataOffsetInSeconds,
      });
      const value = (bins[0] + bins[1] + bins[2]) / 3;
      if (value > peak) {
        peak = value;
        peakAge = age;
      }
    }
  const pulse = peak * 0.6 ** peakAge;
  const bars = design.visualizer && (
    <Visualizer
      bars={design.bars}
      audioData={audioData}
      color={design.color}
      intensity={design.intensity}
      dataOffsetInSeconds={dataOffsetInSeconds}
      blendLayer={blendLayer}
    />
  );
  return (
    <>
      <AbsoluteFill
        style={{
          transform: `scale(${1 + pulse * 0.03})`,
          filter: `blur(${pulse * 10}px)`,
        }}
      >
        {children}
      </AbsoluteFill>
      {bars}
      {lyrics}
      {bars}
    </>
  );
}
export function DesignBackground({
  children,
  design,
  src,
  audioSrc,
}: {
  design: Design;
  src: string;
  children: React.ReactNode;
  audioSrc: string;
}) {
  const { fps } = useVideoConfig();
  const { isPlayer } = useRemotionEnvironment();
  const AudioEffects = isPlayer ? PreviewEffects : RenderEffects;
  const freezeStartMs = design.freezeStartMs ?? 0;
  const hasFreeze = design.kind === "original" && freezeStartMs > 0;
  // A local music video often supplies both outputs. Let the browser demux
  // and play it once while the Player drives seeking and excerpt offsets.
  const originalPreview = isPlayer && design.kind === "original";
  const [nativeFailed, setNativeFailed] = useState(false);
  const nativeFootage = originalPreview && !nativeFailed;
  const embeddedSoundtrack = originalPreview && src === audioSrc && !hasFreeze;
  const fallbackToDecoder = useCallback(() => setNativeFailed(true), []);
  const style = { width: "100%", height: "100%", objectFit: design.fit };

  const renderVideo = (muted: boolean) =>
    nativeFootage ? (
      <Html5Video
        src={src}
        muted={muted}
        style={style}
        onError={fallbackToDecoder}
      />
    ) : (
      <Video src={src} muted={muted} style={style} objectFit={design.fit} />
    );

  const startFreezeFrames = Math.max(
    0,
    Math.round((freezeStartMs * fps) / 1000),
  );

  const footageVisual = hasFreeze ? (
    <>
      {startFreezeFrames > 0 && (
        <Sequence durationInFrames={startFreezeFrames}>
          <Freeze frame={0}>{renderVideo(true)}</Freeze>
        </Sequence>
      )}
      <Sequence from={startFreezeFrames} premountFor={startFreezeFrames}>
        {renderVideo(!embeddedSoundtrack)}
      </Sequence>
    </>
  ) : (
    renderVideo(!embeddedSoundtrack)
  );

  const visual =
    design.kind === "loop" ? (
      <LoopClip src={src} design={design} />
    ) : design.kind === "image" ? (
      <Img src={src} style={style} />
    ) : (
      footageVisual
    );
  return (
    <>
      {!embeddedSoundtrack &&
        (nativeFootage ? (
          <Html5Audio src={audioSrc} onError={fallbackToDecoder} />
        ) : (
          <Audio src={audioSrc} />
        ))}
      {design.visualizer || design.bassPulse ? (
        <AudioEffects
          key={audioSrc}
          lyrics={children}
          audioSrc={audioSrc}
          design={design}
        >
          {visual}
        </AudioEffects>
      ) : (
        <>
          {visual}
          {children}
        </>
      )}
    </>
  );
}
