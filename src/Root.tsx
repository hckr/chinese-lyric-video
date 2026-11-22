import { Composition, Still } from "remotion";
import { LyricVideo } from "./LyricVideo";
import { LyricVideoThumbnail } from "./LyricVideoThumbnail";
import { LyricVideoThumbnail2 } from "./LyricVideoThumbnail2";
import { LyricVideo2 } from "./LyricVideo2";
import { LyricVideo as LyricVideoOnlyPinin } from "./LyricVideoOnlyPinin";
import { LyricVideoThumbnail as LyricVideoThumbnailOnlyPinyin } from "./LyricVideoThumbnailOnlyPinyin";
import { LyricVideo as LyricVideoShort } from "./LyricVideoShort";

// Reusable Templates & Schemas
import { VideoLyricTemplate } from "./remotion/templates/VideoLyricTemplate";
import { ImageVisualizerTemplate } from "./remotion/templates/ImageVisualizerTemplate";
import { ThumbnailTemplate } from "./remotion/templates/ThumbnailTemplate";
import {
  VideoLyricTemplateSchema,
  ImageVisualizerTemplateSchema,
  ThumbnailTemplateSchema,
} from "./remotion/templates/types";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ========================================================
          1. Legacy song compositions (interactive in Studio via templates)
         ======================================================== */}
      <Composition
        id="LyricVideo"
        component={LyricVideo}
        durationInFrames={5196}
        fps={23.976}
        width={1920}
        height={1080}
      />
      <Composition
        id="LyricVideoOnlyPinin"
        component={LyricVideoOnlyPinin}
        durationInFrames={5196}
        fps={23.976}
        width={1920}
        height={1080}
      />
      <Composition
        id="LyricVideoShort"
        component={LyricVideoShort}
        durationInFrames={852}
        fps={23.976}
        width={1080}
        height={1920}
      />
      <Composition
        id="LyricVideo2"
        component={LyricVideo2}
        durationInFrames={4612}
        fps={25}
        width={1920}
        height={1080}
      />
      <Still
        id="Thumbnail"
        component={LyricVideoThumbnail}
        schema={ThumbnailTemplateSchema}
        width={1280}
        height={720}
        defaultProps={{
          bgImageSrc: "thumbnail-bg-369.png",
          bgImageOpacity: 0.6,
          musicNotesWatermark: "♪♬",
          topLabel: "Mandarin song lyrics\nPinyin · English · Polish",
          bottomLabel: "characters with pinyin",
          titleEn: "Keep Walking in the Rain",
          mode: "full",
        }}
      />
      <Still
        id="ThumbnailOnlyPinyin"
        component={LyricVideoThumbnailOnlyPinyin}
        schema={ThumbnailTemplateSchema}
        width={1280}
        height={720}
        defaultProps={{
          bgImageSrc: "thumbnail-bg-369.png",
          bgImageOpacity: 0.6,
          musicNotesWatermark: "♪♬",
          topLabel: "Mandarin song lyrics",
          bottomLabel: "characters with pinyin",
          titleEn: "Keep Walking in the Rain",
          mode: "only-pinyin",
        }}
      />
      <Still
        id="Thumbnail2"
        component={LyricVideoThumbnail2}
        schema={ThumbnailTemplateSchema}
        width={1280}
        height={720}
        defaultProps={{
          bgImageSrc: "vlcsnap-2026-06-20-20h55m06s209.png",
          bgImageOpacity: 0.9,
          musicNotesWatermark: "♪♪♪♪",
          topLabel: "Mandarin song lyrics\nPinyin · English · Polish",
          bottomLabel: "characters with pinyin",
          titleEn: "Keep Walking",
          mode: "title-only",
        }}
      />

      {/* ========================================================
          2. Reusable Templates (for building future videos)
         ======================================================== */}
      <Composition
        id="Template-Video-Landscape"
        component={VideoLyricTemplate}
        schema={VideoLyricTemplateSchema}
        durationInFrames={5196}
        fps={23.976}
        width={1920}
        height={1080}
        defaultProps={{
          videoSrc: "Angela_Zhang_Keep_Walking.mp4",
          lyricMode: "full",
          variant: "landscape",
          sequenceOffset: 0,
          showWatermark: true,
          watermarkText: "@SingInMandarin",
          showDimOverlay: true,
        }}
      />
      <Composition
        id="Template-Video-Short"
        component={VideoLyricTemplate}
        schema={VideoLyricTemplateSchema}
        durationInFrames={852}
        fps={23.976}
        width={1080}
        height={1920}
        defaultProps={{
          videoSrc: "Angela_Zhang_Keep_Walking.mp4",
          lyricMode: "full",
          variant: "short",
          sequenceOffset: -1074,
          showWatermark: true,
          watermarkText: "@SingInMandarin",
          showDimOverlay: true,
        }}
      />
      <Composition
        id="Template-ImageVisualizer-Landscape"
        component={ImageVisualizerTemplate}
        schema={ImageVisualizerTemplateSchema}
        durationInFrames={4612}
        fps={25}
        width={1920}
        height={1080}
        defaultProps={{
          imageSrc: "macchiato_cover.png",
          audioSrc: "Macchiato_Special_Affection_for_You.mp4",
          lyricMode: "full",
          variant: "landscape",
          sequenceOffset: 0,
          showWatermark: true,
          watermarkText: "@SingInMandarin",
          showDimOverlay: false,
          bassPulse: true,
          showVisualizer: true,
        }}
      />
      <Composition
        id="Template-ImageVisualizer-Short"
        component={ImageVisualizerTemplate}
        schema={ImageVisualizerTemplateSchema}
        durationInFrames={4612}
        fps={25}
        width={1080}
        height={1920}
        defaultProps={{
          imageSrc: "macchiato_cover.png",
          audioSrc: "Macchiato_Special_Affection_for_You.mp4",
          lyricMode: "full",
          variant: "short",
          sequenceOffset: 0,
          showWatermark: true,
          watermarkText: "@SingInMandarin",
          showDimOverlay: false,
          bassPulse: true,
          showVisualizer: true,
        }}
      />
      <Still
        id="Template-Thumbnail"
        component={ThumbnailTemplate}
        schema={ThumbnailTemplateSchema}
        width={1280}
        height={720}
        defaultProps={{
          bgImageSrc: "thumbnail-bg-369.png",
          bgImageOpacity: 0.6,
          musicNotesWatermark: "♪♬",
          topLabel: "Mandarin song lyrics\nPinyin · English · Polish",
          bottomLabel: "characters with pinyin",
          titleEn: "Keep Walking in the Rain",
          mode: "full",
        }}
      />
    </>
  );
};
