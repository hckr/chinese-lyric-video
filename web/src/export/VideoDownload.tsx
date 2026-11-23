import { canEncodeVideo, Quality, type VideoCodec } from "mediabunny";
import {
  inspectAudioCopy,
  muxOriginalAudio,
  probeExportEncoder,
} from "./export-media.ts";
import { useSourceFps } from "../video/useSourceFps.ts";
import { useContext, useEffect, useRef, useState } from "react";
import type { Project } from "../domain.ts";
import { AssetContext } from "../video/video-assets.tsx";
import {
  jobMedia,
  resolveFootageJob,
  videoSettingsSchema,
  videoVariants,
} from "../video/video-settings.ts";

const codecs = {
  mp4: ["h264", "h265", "av1"],
  webm: ["vp8", "vp9", "av1"],
} as const;
type Container = keyof typeof codecs;
type Codec = (typeof codecs)[Container][number];
const encoderCodec = (codec: Codec): VideoCodec =>
  codec === "h264" ? "avc" : codec === "h265" ? "hevc" : codec;
type CodecStatus =
  | "Hardware preferred"
  | "Encoding available"
  | "Unavailable"
  | "Unknown";

export function VideoDownload({
  project,
  file,
}: {
  project: Project;
  file: File | null;
}) {
  const settings = project.videoSettings ?? videoSettingsSchema.parse({});
  const { files } = useContext(AssetContext);
  const [designId, setDesignId] = useState(settings.activeDesign);
  const [variant, setVariant] = useState(settings.variant);
  const design =
    settings.designs.find((item) => item.id === designId) ??
    settings.designs.find((item) => item.id === settings.activeDesign);
  const [chosenContainer, setContainer] = useState<Container>();
  const [chosenCodec, setCodec] = useState<Codec>();
  const [scale, setScale] = useState(1);
  const [rate, setRate] = useState("auto");
  const [quality, setQuality] = useState("medium");
  const [bitrate, setBitrate] = useState(18);
  const [copyAudio, setCopyAudio] = useState(true);
  const [audioProbe, setAudioProbe] = useState<{
    key: string;
    file: File;
    issue: string;
  }>();
  const [support, setSupport] = useState<{ key: string; message: string }>();
  const [progress, setProgress] = useState<number>();
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ url: string; name: string }>();
  const running = useRef<AbortController | null>(null);
  useEffect(() => () => running.current?.abort(), []);
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );

  const frameSource =
    design?.kind === "original" || design?.kind === "loop"
      ? design.asset
        ? files.get(design.asset.id)
        : file
      : undefined;
  const measured = useSourceFps(rate === "auto" ? frameSource : undefined);
  let source:
    | ({ job: ReturnType<typeof resolveFootageJob> } & ReturnType<
        typeof jobMedia
      >)
    | undefined;
  let issue = "";
  try {
    if (!design) throw Error("Choose a video design.");
    const media = jobMedia(project, file, files, design);
    const fps =
      rate !== "auto"
        ? Number(rate)
        : design.kind === "image"
          ? 30
          : measured?.fps;
    const job = resolveFootageJob(project, design.id, variant, fps);
    source = { job, ...media };
  } catch (error) {
    issue = error instanceof Error ? error.message : String(error);
  }

  const fpsPending =
    rate === "auto" && frameSource && measured?.file !== frameSource;
  const fpsUnknown =
    rate === "auto" &&
    frameSource &&
    measured?.file === frameSource &&
    !measured.fps;
  const width = variant === "short" ? 1080 : 1920;
  const height = variant === "short" ? 1920 : 1080;
  const videoBitrate =
    quality === "custom"
      ? bitrate * 1000000
      : quality === "high"
        ? ("high" as const)
        : ("medium" as const);
  const codecKey = JSON.stringify([width, height, scale, videoBitrate]);
  const [codecSupport, setCodecSupport] = useState<{
    key: string;
    entries: Partial<Record<Codec, CodecStatus>>;
  }>();
  useEffect(() => {
    let active = true;
    const options = {
      width: width * scale,
      height: height * scale,
      bitrate:
        typeof videoBitrate === "number"
          ? videoBitrate
          : new Quality(videoBitrate),
    };
    const timer = setTimeout(() => {
      void Promise.all(
        [...new Set<Codec>([...codecs.webm, ...codecs.mp4])].map(
          async (item): Promise<[Codec, CodecStatus]> => {
            try {
              if (!(await canEncodeVideo(encoderCodec(item), options)))
                return [item, "Unavailable"];
              const hardware = await canEncodeVideo(encoderCodec(item), {
                ...options,
                hardwareAcceleration: "prefer-hardware",
              });
              return [
                item,
                hardware ? "Hardware preferred" : "Encoding available",
              ];
            } catch {
              return [item, "Unknown"];
            }
          },
        ),
      ).then((entries) => {
        if (active)
          setCodecSupport({
            key: codecKey,
            entries: Object.fromEntries(entries),
          });
      });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [codecKey, width, height, scale, videoBitrate]);
  const entries =
    codecSupport?.key === codecKey ? codecSupport.entries : undefined;
  const hasHardware = (format: Container) =>
    codecs[format].some((item) => entries?.[item] === "Hardware preferred");
  const container =
    chosenContainer ??
    (hasHardware("mp4") && !hasHardware("webm") ? "mp4" : "webm");
  const codec =
    chosenCodec ??
    codecs[container].find(
      (item) => entries?.[item] === "Hardware preferred",
    ) ??
    codecs[container].find(
      (item) => entries?.[item] === "Encoding available",
    ) ??
    codecs[container][0];
  const hardwareAcceleration =
    entries?.[codec] === "Hardware preferred"
      ? "prefer-hardware"
      : "no-preference";
  const audioFile = source?.audio;
  const durationMs = source?.job.durationMs;
  const audioKey = container + "/" + durationMs;
  useEffect(() => {
    if (!copyAudio || !audioFile || !durationMs || variant === "short") return;
    let active = true;
    const finish = (issue: string) => {
      if (active) setAudioProbe({ key: audioKey, file: audioFile, issue });
    };
    void inspectAudioCopy(audioFile, container, durationMs / 1000).then(
      finish,
      () => finish("Source audio could not be inspected."),
    );
    return () => {
      active = false;
    };
  }, [audioFile, audioKey, container, copyAudio, durationMs, variant]);
  const audioIssue = !copyAudio
    ? "Audio encoding selected."
    : variant === "short"
      ? "Portrait excerpts use audio encoding to preserve cut timing."
      : audioProbe?.file === audioFile && audioProbe?.key === audioKey
        ? audioProbe.issue
        : undefined;
  const shouldCopy = audioIssue === "";
  const fps = source?.job.fps ?? 30;
  const supportKey = JSON.stringify([
    container,
    codec,
    width,
    height,
    scale,
    fps,
    videoBitrate,
    shouldCopy,
  ]);
  async function checkSupport(preferHardware: boolean) {
    const { canRenderMediaOnWeb } = await import("@remotion/web-renderer");
    const checked = await canRenderMediaOnWeb({
      container,
      videoCodec: codec,
      audioCodec: container === "mp4" ? "aac" : "opus",
      width,
      height,
      scale,
      videoBitrate,
      muted: shouldCopy,
    });
    if (!checked.canRender)
      throw Error(checked.issues.map((item) => item.message).join(" "));
    if (!preferHardware) return;
    const probe = {
      container,
      codec: encoderCodec(codec),
      width: width * scale,
      height: height * scale,
      fps,
      bitrate: videoBitrate,
    };
    await probeExportEncoder({
      ...probe,
      muted: shouldCopy,
      hardware: "no-preference",
    }).catch(() => {
      throw Error(
        "The browser reported support but could not encode a test file with these settings. Try another codec or resolution, or use Studio.",
      );
    });
    const hardware = await probeExportEncoder({
      ...probe,
      muted: true,
      hardware: "prefer-hardware",
    }).then(
      () => true,
      () => false,
    );
    setSupport({
      key: supportKey,
      message: hardware
        ? "Encoding supported, including a hardware-preferred probe. The browser may still use software."
        : "Encoding supported. The hardware-preferred probe did not pass.",
    });
  }

  async function render() {
    if (
      !source ||
      running.current ||
      fpsPending ||
      fpsUnknown ||
      audioIssue === undefined
    )
      return;
    const controller = new AbortController();
    running.current = controller;
    const { signal } = controller;
    const { job, visual, audio } = source;
    const videoSrc = URL.createObjectURL(visual);
    const audioSrc = visual === audio ? videoSrc : URL.createObjectURL(audio);
    setProgress(0);
    setMessage("");
    setResult(undefined);
    try {
      await checkSupport(false);
      signal.throwIfAborted();
      const [{ renderMediaOnWeb }, { WorkbenchVideo }] = await Promise.all([
        import("@remotion/web-renderer"),
        import("../../../src/remotion/templates/WorkbenchJobs"),
        import("../video/preview-fonts.ts"),
      ]);
      signal.throwIfAborted();
      const text = job.lines.map((line) => JSON.stringify(line)).join("");
      await Promise.allSettled(
        ["Noto Sans SC", "Inter", "Lexend Deca"].map((font) =>
          document.fonts.load(`400 16px "${font}"`, text),
        ),
      );
      signal.throwIfAborted();
      const props = { ...job, videoSrc, audioSrc };
      const encoded = await renderMediaOnWeb({
        composition: {
          id: "Workbench-Video",
          component: WorkbenchVideo,
          defaultProps: props,
          width,
          height,
          fps: job.fps,
          durationInFrames: job.durationInFrames,
        },
        inputProps: props,
        container,
        videoCodec: codec,
        audioCodec: container === "mp4" ? "aac" : "opus",
        videoBitrate,
        audioBitrate: 128000,
        sampleRate: 48000,
        scale,
        muted: shouldCopy,
        hardwareAcceleration,
        pageResponsiveness: "high",
        signal,
        onProgress: ({ progress }) => {
          if (!signal.aborted) setProgress(progress);
        },
      });
      let blob = await encoded.getBlob();
      if (shouldCopy) {
        setMessage("Copying original audio…");
        blob = await muxOriginalAudio(blob, audio, container, signal);
        setMessage("");
      }
      signal.throwIfAborted();
      const name = [project.metadata.title, job.design.name, variant]
        .join("-")
        .normalize("NFC")
        .replace(/[^\p{L}\p{N}_-]+/gu, "-")
        .slice(0, 120);
      setResult({
        url: URL.createObjectURL(blob),
        name: name + "." + container,
      });
    } catch (error) {
      if (!signal.aborted) {
        const detail = error instanceof Error ? error.message : String(error);
        setMessage(
          detail === "Encoding error."
            ? "The browser encoder failed. Try another codec or resolution, or prepare the job for Studio below."
            : detail,
        );
      }
    } finally {
      URL.revokeObjectURL(videoSrc);
      if (audioSrc !== videoSrc) URL.revokeObjectURL(audioSrc);
      running.current = null;
      setProgress(undefined);
    }
  }

  return (
    <section className="export-jobs">
      <h2>Render and download video</h2>
      <label>
        Design
        <select
          value={design?.id ?? ""}
          disabled={progress !== undefined}
          onChange={(event) => setDesignId(event.target.value)}
        >
          {settings.designs.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Output variant
        <select
          value={variant}
          disabled={progress !== undefined}
          onChange={(event) =>
            setVariant(
              videoSettingsSchema.shape.variant.parse(event.target.value),
            )
          }
        >
          {Object.entries(videoVariants).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <fieldset disabled={progress !== undefined}>
        <legend>File settings</legend>
        <label>
          Container{" "}
          <select
            value={container}
            onChange={(event) => {
              const next = event.target.value as Container;
              setContainer(next);
              setCodec(undefined);
            }}
          >
            <option value="mp4">MP4</option>
            <option value="webm">WebM</option>
          </select>
        </label>
        <label>
          Video codec{" "}
          <select
            value={codec}
            onChange={(event) => {
              setContainer(container);
              setCodec(event.target.value as Codec);
            }}
          >
            {codecs[container].map((item) => (
              <option key={item} value={item}>
                {item.toUpperCase()} ·{" "}
                {codecSupport?.key === codecKey
                  ? (codecSupport.entries[item] ?? "Unknown")
                  : "Checking…"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Resolution{" "}
          <select
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
          >
            <option value={1}>1080p</option>
            <option value={2}>4K</option>
          </select>
        </label>
        <label>
          Frame rate{" "}
          <select
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          >
            <option value="auto">Auto</option>
            {[24000 / 1001, 24, 25, 30000 / 1001, 30, 50, 60000 / 1001, 60].map(
              (value) => (
                <option value={value} key={value}>
                  {Number(value.toFixed(3))} fps
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          Video quality{" "}
          <select
            value={quality}
            onChange={(event) => setQuality(event.target.value)}
          >
            <option value="medium">Standard</option>
            <option value="high">High</option>
            <option value="custom">Custom bitrate</option>
          </select>
        </label>
        {quality === "custom" && (
          <label>
            Video bitrate (Mb/s){" "}
            <input
              type="number"
              min={1}
              max={200}
              value={bitrate}
              onChange={(event) => setBitrate(Number(event.target.value))}
            />
          </label>
        )}
        <label>
          <input
            type="checkbox"
            checked={copyAudio}
            onChange={(event) => setCopyAudio(event.target.checked)}
          />{" "}
          Copy audio when possible
        </label>
        {source && (
          <p>
            {width * scale} × {height * scale} ·{" "}
            {fpsPending
              ? "Reading source FPS…"
              : fpsUnknown
                ? "Source FPS unavailable. Choose a frame rate."
                : Number(fps.toFixed(3)) + " fps"}
            {" · "}
            {shouldCopy
              ? "Copy original audio"
              : (audioIssue ?? "Checking source audio…")}
          </p>
        )}
        <button
          disabled={
            !source ||
            !entries ||
            !!fpsPending ||
            !!fpsUnknown ||
            audioIssue === undefined
          }
          onClick={() => {
            setSupport({
              key: supportKey,
              message: "Checking encoder support…",
            });
            void checkSupport(true).catch((error) =>
              setSupport({ key: supportKey, message: String(error) }),
            );
          }}
        >
          Check encoder support
        </button>
        {support?.key === supportKey && <p role="status">{support.message}</p>}
      </fieldset>
      {issue && <p>{issue}</p>}
      <button
        disabled={
          !source ||
          !!fpsPending ||
          !!fpsUnknown ||
          audioIssue === undefined ||
          !entries ||
          progress !== undefined ||
          (quality === "custom" && (bitrate < 1 || bitrate > 200))
        }
        onClick={() => void render()}
      >
        Render video ({container === "webm" ? "WebM" : "MP4"})
      </button>
      {progress !== undefined && (
        <>
          <progress
            value={progress}
            max={1}
            aria-label="Video render progress"
          />
          <button
            onClick={() => {
              running.current?.abort();
              setMessage("Render canceled.");
            }}
          >
            Cancel render
          </button>
        </>
      )}
      <div aria-live="polite">
        {message && <p>{message}</p>}
        {result && (
          <a href={result.url} download={result.name}>
            Download {result.name}
          </a>
        )}
      </div>
    </section>
  );
}
