import "./preview-fonts.ts";
import { Player, type PlayerRef } from "@remotion/player";
import { useContext, useLayoutEffect, useRef } from "react";
const loadVideo = () =>
  import("../../../src/remotion/templates/WorkbenchJobs").then((module) => ({
    default: module.WorkbenchVideo,
  }));
import type { Project } from "../domain.ts";
import { AssetContext, useAssetUrl } from "./video-assets.tsx";
import { useSourceFps } from "./useSourceFps.ts";
import {
  jobMedia,
  resolveFootageJob,
  videoSettingsSchema,
} from "./video-settings.ts";

export default function FootagePreview({
  project,
  file,
}: {
  project: Project;
  file: File | null;
}) {
  const { files } = useContext(AssetContext);
  const player = useRef<PlayerRef>(null);
  const sourceFrame = useRef(0);
  const settings = project.videoSettings ?? videoSettingsSchema.parse({});
  const design = settings.designs.find(
    (item) => item.id === settings.activeDesign,
  );
  const frameSource =
    design?.kind === "image"
      ? undefined
      : design?.asset
        ? files.get(design.asset.id)
        : file;
  const measured = useSourceFps(frameSource);
  let media;
  let job;
  let issue = "";
  try {
    job = resolveFootageJob(project, undefined, undefined, measured?.fps);
    media = jobMedia(project, file, files, job.design);
  } catch (error) {
    issue = error instanceof Error ? error.message : String(error);
  }
  const src = useAssetUrl(media?.visual);
  const separateAudioSrc = useAssetUrl(
    media?.audio === media?.visual ? undefined : media?.audio,
  );
  const audioSrc = media?.audio === media?.visual ? src : separateAudioSrc;
  const fps = job?.fps ?? 23.976;
  const offset = job?.sequenceOffset;
  const duration = job?.durationInFrames;
  useLayoutEffect(() => {
    const p = player.current;
    if (!p || offset === undefined || duration === undefined) return;
    const frame = Math.round(sourceFrame.current * fps) + offset;
    p.seekTo(frame >= 0 && frame < duration ? frame : 0);
    const track = () => {
      sourceFrame.current = (p.getCurrentFrame() - offset) / fps;
    };
    track();
    p.addEventListener("frameupdate", track);
    return () => p.removeEventListener("frameupdate", track);
  }, [offset, duration, src, audioSrc, fps]);
  if (issue || !job) return <p>{issue}</p>;
  if (!src || !audioSrc || (job.design.kind !== "image" && !measured))
    return <p>Loading media…</p>;
  return (
    <Player
      key={src + "|" + audioSrc + "|" + job.design.kind}
      ref={player}
      lazyComponent={loadVideo}
      inputProps={{ ...job, videoSrc: src, audioSrc }}
      compositionWidth={job.portrait ? 1080 : 1920}
      compositionHeight={job.portrait ? 1920 : 1080}
      fps={fps}
      durationInFrames={job.durationInFrames}
      controls
      style={{
        width: "100%",
        maxHeight: "65vh",
        aspectRatio: job.portrait ? "9 / 16" : "16 / 9",
      }}
      errorFallback={({ error }) => <p role="alert">{error.message}</p>}
    />
  );
}
