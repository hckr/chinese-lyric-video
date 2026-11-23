import "./preview-fonts.ts";
import { Thumbnail } from "@remotion/player";
import { WorkbenchStill } from "../../src/remotion/templates/WorkbenchJobs";
import type { ThumbnailTemplateProps } from "../../src/remotion/templates/types";
export default function ThumbnailPreview(props: ThumbnailTemplateProps) {
  return (
    <Thumbnail
      component={WorkbenchStill}
      inputProps={props}
      compositionWidth={1280}
      compositionHeight={720}
      durationInFrames={1}
      fps={25}
      frameToDisplay={0}
      style={{ width: "100%", aspectRatio: "16 / 9" }}
    />
  );
}
