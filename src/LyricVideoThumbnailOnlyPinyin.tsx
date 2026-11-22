import React from "react";
import { ThumbnailTemplate } from "./remotion/templates/ThumbnailTemplate";
import { ThumbnailTemplateProps } from "./remotion/templates/types";

// Root.tsx imports this file as: import { LyricVideoThumbnail as LyricVideoThumbnailOnlyPinyin }
export const LyricVideoThumbnail: React.FC<ThumbnailTemplateProps> = (
  props,
) => <ThumbnailTemplate mode="only-pinyin" {...props} />;
