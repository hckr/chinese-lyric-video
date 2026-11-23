import {
  ALL_FORMATS,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  type VideoCodec,
} from "mediabunny";

const rates = [24000 / 1001, 24, 25, 30000 / 1001, 30, 50, 60000 / 1001, 60];
const fpsCache = new WeakMap<File, Promise<number>>();
export function sourceVideoFps(file: File) {
  let pending = fpsCache.get(file);
  if (!pending) {
    pending = (async () => {
      const input = new Input({
        source: new BlobSource(file),
        formats: ALL_FORMATS,
      });
      try {
        const track = await input.getPrimaryVideoTrack();
        const rate = (
          await track?.computePacketStats(300, { metadataOnly: true })
        )?.averagePacketRate;
        if (!rate || !Number.isFinite(rate) || rate < 1)
          throw Error(
            "Could not determine source FPS. Choose an output frame rate.",
          );
        return (
          rates.find((standard) => Math.abs(standard - rate) < 0.01) ??
          Math.round(rate * 1000) / 1000
        );
      } finally {
        input.dispose();
      }
    })();
    fpsCache.set(file, pending);
  }
  return pending;
}

type Container = "mp4" | "webm";
const outputFormat = (container: Container) =>
  container === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat();

export async function probeExportEncoder({
  container,
  codec,
  width,
  height,
  fps,
  bitrate,
  muted,
  hardware,
}: {
  container: Container;
  codec: VideoCodec;
  width: number;
  height: number;
  fps: number;
  bitrate: number | "medium" | "high";
  muted: boolean;
  hardware: "no-preference" | "prefer-hardware";
}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.fillRect(0, 0, width, height);
  const target = new BufferTarget();
  const output = new Output({ format: outputFormat(container), target });
  const video = new CanvasSource(canvas, {
    codec,
    bitrate: typeof bitrate === "number" ? bitrate : new Quality(bitrate),
    hardwareAcceleration: hardware,
    alpha: "discard",
  });
  const audio = muted
    ? null
    : new AudioBufferSource({
        codec: container === "mp4" ? "aac" : "opus",
        bitrate: 128000,
      });
  output.addVideoTrack(video, { frameRate: fps });
  if (audio) output.addAudioTrack(audio);
  try {
    await output.start();
    await Promise.all([
      video.add(0, 1 / fps).then(() => video.close()),
      audio
        ?.add(
          new AudioBuffer({
            length: 4800,
            sampleRate: 48000,
            numberOfChannels: 2,
          }),
        )
        .then(() => audio.close()),
    ]);
    await output.finalize();
  } finally {
    if (output.state !== "finalized") await output.cancel();
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function inspectAudioCopy(
  file: File,
  container: Container,
  duration: number,
) {
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });
  try {
    const track = await input.getPrimaryAudioTrack();
    const codec = await track?.getCodec();
    if (
      !track ||
      !codec ||
      !outputFormat(container).getSupportedAudioCodecs().includes(codec)
    )
      return "The source audio codec is incompatible with this container.";
    if (
      Math.abs(await track.getFirstTimestamp()) > 0.075 ||
      Math.abs((await track.computeDuration()) - duration) > 0.075
    )
      return "Source audio timing differs from the output.";
    if (!(await track.getDecoderConfig()))
      return "The source audio has no usable codec configuration.";
    return "";
  } finally {
    input.dispose();
  }
}

export async function muxOriginalAudio(
  video: Blob,
  audio: File,
  container: Container,
  signal: AbortSignal,
) {
  const picture = new Input({
    source: new BlobSource(video),
    formats: ALL_FORMATS,
  });
  const soundtrack = new Input({
    source: new BlobSource(audio),
    formats: ALL_FORMATS,
  });
  const target = new BufferTarget();
  const output = new Output({ format: outputFormat(container), target });
  const cancel = () => {
    void output.cancel();
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    const videoTrack = await picture.getPrimaryVideoTrack();
    const audioTrack = await soundtrack.getPrimaryAudioTrack();
    const videoCodec = await videoTrack?.getCodec();
    const audioCodec = await audioTrack?.getCodec();
    const videoConfig = await videoTrack?.getDecoderConfig();
    const audioConfig = await audioTrack?.getDecoderConfig();
    if (
      !videoTrack ||
      !audioTrack ||
      !videoCodec ||
      !audioCodec ||
      !videoConfig ||
      !audioConfig
    )
      throw Error(
        "Could not read the encoded tracks. Retry with audio encoding enabled.",
      );
    const pictureSource = new EncodedVideoPacketSource(videoCodec);
    const soundtrackSource = new EncodedAudioPacketSource(audioCodec);
    output.addVideoTrack(pictureSource);
    output.addAudioTrack(soundtrackSource);
    signal.throwIfAborted();
    await output.start();
    await Promise.all([
      (async () => {
        for await (const packet of new EncodedPacketSink(
          videoTrack,
        ).packets()) {
          signal.throwIfAborted();
          await pictureSource.add(packet, { decoderConfig: videoConfig });
        }
        pictureSource.close();
      })(),
      (async () => {
        for await (const packet of new EncodedPacketSink(
          audioTrack,
        ).packets()) {
          signal.throwIfAborted();
          await soundtrackSource.add(packet, { decoderConfig: audioConfig });
        }
        soundtrackSource.close();
      })(),
    ]);
    signal.throwIfAborted();
    await output.finalize();
    if (!target.buffer) throw Error("Could not finalize the video file.");
    return new Blob([target.buffer], { type: "video/" + container });
  } finally {
    signal.removeEventListener("abort", cancel);
    if (output.state !== "finalized") await output.cancel();
    picture.dispose();
    soundtrack.dispose();
  }
}
