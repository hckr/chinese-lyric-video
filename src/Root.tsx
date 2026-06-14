import { Composition, Still } from "remotion";
import { LyricVideo } from "./LyricVideo";
import { LyricVideoThumbnail } from "./LyricVideoThumbnail";

// Each <Composition> is an entry in the sidebar!

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
      <Still
        id="Thumbnail"
        component={LyricVideoThumbnail}
        width={1280}
        height={720}
      />
    </>
  );
};
