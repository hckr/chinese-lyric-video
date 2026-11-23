export { fontFamily as notoSansSCFont } from "@remotion/google-fonts/NotoSansSC";
export { fontFamily as interFont } from "@remotion/google-fonts/Inter";
export { fontFamily as lexendDecaFont } from "@remotion/google-fonts/LexendDeca";

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
