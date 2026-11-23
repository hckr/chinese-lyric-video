import { loadFont as loadNotoSansSC } from "@remotion/google-fonts/NotoSansSC";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadLexendDeca } from "@remotion/google-fonts/LexendDeca";

loadNotoSansSC("normal", {
  weights: ["400"],
});

loadInter("normal", {
  weights: ["400"],
  subsets: ["latin", "latin-ext"],
});

loadLexendDeca("normal", {
  weights: ["400"],
  subsets: ["latin", "latin-ext"],
});
