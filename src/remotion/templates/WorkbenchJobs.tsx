import type { Design } from "../../../web/src/designs";
import { DesignBackground } from "../backgrounds/DesignBackground";
import { AbsoluteFill, Composition, Still } from "remotion";
import { VideoLyricTemplate } from "./VideoLyricTemplate";
import { ThumbnailTemplate } from "./ThumbnailTemplate";
import type { ThumbnailTemplateProps } from "./types";
import type { TimedLineData } from "../lyrics/types";

type FootageJob = {
  outName?: string;
  outro?: import("../overlays/Outro").OutroProps;
  design?: Design;
  audioSrc?: string;
  fps?: number;
  layout?: Design["overrides"][string];
  videoSrc: string;
  durationMs: number;
  lines: TimedLineData[];
  portrait?: boolean;
  lyricMode?: "only-pinyin" | "full";
  durationInFrames?: number;
  sequenceOffset?: number;
  showPinyin?: boolean;
  showWatermark?: boolean;
};

const EmptyJob = () => (
  <AbsoluteFill
    style={{
      background: "black",
      color: "white",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    Open a prepared workbench job.
  </AbsoluteFill>
);

export const WorkbenchVideo = ({
  outro,
  design,
  audioSrc,
  layout,
  videoSrc,
  lines,
  portrait,
  lyricMode,
  sequenceOffset,
  showPinyin,
  showWatermark,
}: FootageJob) =>
  videoSrc && lines.length ? (
    <VideoLyricTemplate
      videoSrc={videoSrc}
      outro={outro}
      layout={layout}
      showDimOverlay={design?.dim}
      renderScene={
        design && audioSrc
          ? (lyrics) => (
              <DesignBackground
                design={design}
                src={videoSrc}
                audioSrc={audioSrc}
              >
                {lyrics}
              </DesignBackground>
            )
          : undefined
      }
      lines={lines}
      lyricMode={lyricMode}
      variant={portrait ? "short" : "landscape"}
      sequenceOffset={sequenceOffset}
      showPinyin={showPinyin}
      showWatermark={showWatermark}
    />
  ) : (
    <EmptyJob />
  );

export const WorkbenchStill = (
  props: ThumbnailTemplateProps & { outName?: string },
) =>
  props.bgImageSrc ? (
    <ThumbnailTemplate
      {...props}
      titleWords={props.titleWords ?? []}
      titleEn={props.titleEn ?? ""}
    />
  ) : (
    <EmptyJob />
  );

export const WorkbenchJobs = () => (
  <>
    <Composition
      id="Workbench-Video"
      component={WorkbenchVideo}
      defaultProps={
        {
          videoSrc: "",
          durationMs: 0,
          lines: [] as TimedLineData[],
        } as FootageJob
      }
      width={1920}
      height={1080}
      fps={23.976}
      durationInFrames={1}
      calculateMetadata={({ props }) => ({
        defaultOutName: props.outName,
        fps: props.fps ?? 23.976,
        width: props.portrait ? 1080 : 1920,
        height: props.portrait ? 1920 : 1080,
        durationInFrames:
          props.durationInFrames ??
          Math.max(1, Math.round((props.durationMs * 23.976) / 1000)),
      })}
    />
    <Still
      id="Workbench-Thumbnail"
      component={WorkbenchStill}
      width={1280}
      height={720}
      calculateMetadata={({ props }) => ({
        defaultOutName:
          typeof props.outName === "string" ? props.outName : undefined,
      })}
      defaultProps={
        { bgImageSrc: "" } as ThumbnailTemplateProps & { outName?: string }
      }
    />
  </>
);
