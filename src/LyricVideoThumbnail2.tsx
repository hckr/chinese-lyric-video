import React from "react";
import { ThumbnailTemplate } from "./remotion/templates/ThumbnailTemplate";
import { ThumbnailTemplateProps } from "./remotion/templates/types";

export const LyricVideoThumbnail2: React.FC<ThumbnailTemplateProps> = (
  props,
) => <ThumbnailTemplate mode="title-only" {...props} />;
