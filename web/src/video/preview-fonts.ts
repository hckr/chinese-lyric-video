import { getInfo as noto } from "@remotion/google-fonts/NotoSansSC";
import { getInfo as inter } from "@remotion/google-fonts/Inter";
import { getInfo as lexend } from "@remotion/google-fonts/LexendDeca";

// Register faces without fetching them. The browser selects subsets from
// the glyphs actually visible in the Player or thumbnail.
for (const info of [noto(), inter(), lexend()]) {
  const ranges: Record<string, string> = info.unicodeRanges;
  for (const [subset, url] of Object.entries(info.fonts.normal["400"])) {
    if (
      info.fontFamily !== "Noto Sans SC" &&
      subset !== "latin" &&
      subset !== "latin-ext"
    )
      continue;
    document.fonts.add(
      new FontFace(info.fontFamily, `url("${url}")`, {
        weight: "400",
        unicodeRange: ranges[subset],
        display: "swap",
      }),
    );
  }
}
