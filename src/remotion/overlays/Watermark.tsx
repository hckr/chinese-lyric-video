import React from "react";
import { lexendDecaFont, heavyTextShadow } from "../design/fonts";

/**
 * "@SingInMandarin" watermark displayed in the top-right corner of all
 * footage compositions.
 */
export const Watermark: React.FC<{ text?: string }> = ({
  text = "@SingInMandarin",
}) => <div style={watermarkStyle}>{text}</div>;

const watermarkStyle: React.CSSProperties = {
  position: "absolute",
  top: "20px",
  right: "25px",
  fontFamily: lexendDecaFont,
  fontSize: "32px",
  fontWeight: 600,
  color: "#fff",
  textShadow: heavyTextShadow("#009c9f"),
  letterSpacing: "0.1em",
  opacity: 0.5,
};
