import { loadFont as loadNotoSansSC } from "@remotion/google-fonts/NotoSansSC";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadLexendDeca } from "@remotion/google-fonts/LexendDeca";

export const { fontFamily: notoSansSCFont } = loadNotoSansSC("normal", {
  weights: ["400"],
});

export const { fontFamily: interFont } = loadInter("normal", {
  weights: ["400"],
  subsets: ["latin", "latin-ext"],
});

export const { fontFamily: lexendDecaFont } = loadLexendDeca("normal", {
  weights: ["400"],
  subsets: ["latin", "latin-ext"],
});

/** Dense multi-offset text stroke at 1px offset. */
export function heavyTextShadow(color: string): string {
  return (
    `1px 1px 3px ${color}, -1px -1px 3px ${color}, -1px 1px 3px ${color}, 1px -1px 3px ${color},` +
    `1px 1px 3px ${color}, -1px -1px 3px ${color}, -1px 1px 3px ${color}, 1px -1px 3px ${color},` +
    `1px 1px 3px ${color}, -1px -1px 3px ${color}, -1px 1px 3px ${color}, 1px -1px 3px ${color},` +
    `1px 1px 2px ${color}, -1px -1px 2px ${color}, -1px 1px 2px ${color}, 1px -1px 2px ${color},` +
    `1px 1px 2px ${color}, -1px -1px 2px ${color}, -1px 1px 2px ${color}, 1px -1px 2px ${color},` +
    `1px 1px 1px ${color}, -1px -1px 1px ${color}, -1px 1px 1px ${color}, 1px -1px 1px ${color}`
  );
}

/** Heavier 2px-offset variant used in thumbnails. */
export function heavyTextShadow2(color: string): string {
  return (
    `2px 2px 3px ${color}, -2px -2px 3px ${color}, -2px 2px 3px ${color}, 2px -2px 3px ${color},` +
    `2px 2px 3px ${color}, -2px -2px 3px ${color}, -2px 2px 3px ${color}, 2px -2px 3px ${color},` +
    `2px 2px 3px ${color}, -2px -2px 3px ${color}, -2px 2px 3px ${color}, 2px -2px 3px ${color},` +
    `1px 1px 2px ${color}, -1px -1px 2px ${color}, -1px 1px 2px ${color}, 1px -1px 2px ${color},` +
    `1px 1px 2px ${color}, -1px -1px 2px ${color}, -1px 1px 2px ${color}, 1px -1px 2px ${color},` +
    `1px 1px 1px ${color}, -1px -1px 1px ${color}, -1px 1px 1px ${color}, 1px -1px 1px ${color}`
  );
}
