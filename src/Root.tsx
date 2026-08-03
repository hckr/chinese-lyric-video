import { Composition, Still } from "remotion";
import { LyricVideo } from "./LyricVideo";
import { LyricVideoThumbnail } from "./LyricVideoThumbnail";
import { LyricVideoThumbnail2 } from "./LyricVideoThumbnail2";
import { LyricVideo2 } from "./LyricVideo2";
import { LyricVideo as LyricVideoOnlyPinin } from "./LyricVideoOnlyPinin";
import { LyricVideoThumbnail as LyricVideoThumbnailOnlyPinyin } from "./LyricVideoThumbnailOnlyPinyin";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LyricVideo"
        component={LyricVideo}
        durationInFrames={5196} // Exact length of the video
        fps={23.976} // Exact frame rate of the video
        width={1920}
        height={1080}
      />
      <Composition
        id="LyricVideoOnlyPinin"
        component={LyricVideoOnlyPinin}
        durationInFrames={5196} // Exact length of the video
        fps={23.976} // Exact frame rate of the video
        width={1920}
        height={1080}
      />
      <Composition
        id="LyricVideo2"
        component={LyricVideo2}
        durationInFrames={4612} // Exact length of the video
        fps={25}
        width={1920}
        height={1080}
      />
      <Still
        id="Thumbnail"
        component={LyricVideoThumbnail}
        width={1280}
        height={720}
      />
      <Still
        id="ThumbnailOnlyPinyin"
        component={LyricVideoThumbnailOnlyPinyin}
        width={1280}
        height={720}
      />
      <Still
        id="Thumbnail2"
        component={LyricVideoThumbnail2}
        width={1280}
        height={720}
      />
    </>
  );
};
