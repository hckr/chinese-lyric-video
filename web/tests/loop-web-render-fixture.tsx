import { Player, type PlayerRef } from "@remotion/player";
import { createRef } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  AudioBufferSink,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  ALL_FORMATS,
  BlobSource,
  Output,
  WebMOutputFormat,
} from "mediabunny";
import { renderMediaOnWeb } from "@remotion/web-renderer";
import { AbsoluteFill } from "remotion";
import { designSchema } from "../src/designs.ts";
import { DesignBackground } from "../../src/remotion/backgrounds/DesignBackground.tsx";
import { syntheticWav } from "./synthetic-wav.ts";

async function verifyLoop() {
  const colors = ["red", "lime", "blue", "yellow"];
  const target = new BufferTarget();
  const output = new Output({ format: new WebMOutputFormat(), target });
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 90;
  const drawing = canvas.getContext("2d")!;
  const track = new CanvasSource(canvas, { codec: "vp8", bitrate: 1000000 });
  output.addVideoTrack(track, { frameRate: 25 });
  await output.start();
  for (let i = 0; i < colors.length; i++) {
    drawing.fillStyle = colors[i];
    drawing.fillRect(0, 0, canvas.width, canvas.height);
    drawing.fillStyle = "white";
    drawing.fillText(String(i), 80, 45);
    await track.add(i / 25, 1 / 25);
  }
  await output.finalize();
  const src = URL.createObjectURL(
    new Blob([target.buffer!], { type: "video/webm" }),
  );
  const audioSrc = URL.createObjectURL(
    new Blob([syntheticWav(1)], { type: "audio/wav" }),
  );
  try {
    const design = designSchema.parse({
      id: "loop",
      name: "Loop",
      kind: "loop",
      loop: "ping-pong",
      endMs: 160,
    });
    const Scene = () => (
      <AbsoluteFill>
        <DesignBackground design={design} src={src} audioSrc={audioSrc}>
          {null}
        </DesignBackground>
      </AbsoluteFill>
    );
    const result = await renderMediaOnWeb({
      composition: {
        id: "LoopCheck",
        component: Scene,
        width: 160,
        height: 90,
        fps: 25,
        durationInFrames: 10,
        defaultProps: {},
      },
      container: "webm",
      videoCodec: "vp8",
      audioCodec: "opus",
    });
    const blob = await result.getBlob();
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(blob),
    });
    try {
      const video = await input.getPrimaryVideoTrack();
      const audio = await input.getAudioTracks();
      if (!video || audio.length !== 1)
        throw Error("Expected one video and one audio track.");
      const sink = new CanvasSink(video);
      const frames = [];
      for (let i = 0; i < 10; i++) {
        const sample = await sink.getCanvas((i + 0.5) / 25);
        if (!sample) throw Error("Missing frame " + i);
        const pixel = sample.canvas
          .getContext("2d")!
          .getImageData(6, 6, 1, 1).data;
        frames.push(
          Array.from(pixel.slice(0, 3), (value) => Number(value > 128)).join(
            "",
          ),
        );
      }
      const first = await new AudioBufferSink(audio[0]).getBuffer(0);
      if (!first) throw Error("Missing soundtrack.");
      const samples = first.buffer.getChannelData(0);
      const rms = Math.sqrt(
        samples.reduce((sum, v) => sum + v * v, 0) / samples.length,
      );
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      const player = createRef<PlayerRef>();
      try {
        flushSync(() =>
          root.render(
            <Player
              ref={player}
              component={Scene}
              inputProps={{}}
              fps={25}
              durationInFrames={10}
              compositionWidth={160}
              compositionHeight={90}
            />,
          ),
        );
        for (const [frame, expected] of frames.entries()) {
          player.current!.seekTo(frame);
          const deadline = performance.now() + 5000;
          let actual = "";
          while (performance.now() < deadline) {
            await new Promise((ok) => setTimeout(ok, 20));
            const surface = host.querySelector("canvas");
            if (!surface || surface.width !== 160) continue;
            actual = Array.from(
              surface
                .getContext("2d")!
                .getImageData(6, 6, 1, 1)
                .data.slice(0, 3),
              (v) => Number(v > 128),
            ).join("");
            if (actual === expected) break;
          }
          if (actual !== expected)
            throw Error(
              "Player frame " + frame + " differs from encoded output.",
            );
        }
      } finally {
        root.unmount();
        host.remove();
      }
      return { frames, rms };
    } finally {
      input.dispose();
    }
  } finally {
    URL.revokeObjectURL(src);
    URL.revokeObjectURL(audioSrc);
  }
}
declare global {
  interface Window {
    verifyLoop: typeof verifyLoop;
  }
}
window.verifyLoop = verifyLoop;
