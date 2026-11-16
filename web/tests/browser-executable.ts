import path from "node:path";

export function browserExecutable(
  platform: string,
  arch: string,
  env: Readonly<Record<string, string | undefined>>,
) {
  if (env.WORKBENCH_BROWSER) return env.WORKBENCH_BROWSER;
  if (
    platform === "darwin" &&
    arch === "x64" &&
    env.CODEX_SANDBOX === "seatbelt"
  )
    return path.resolve("scripts/chrome-seatbelt.sh");
  return path.resolve(
    "node_modules/.remotion/chrome-headless-shell/mac-x64/chrome-headless-shell-mac-x64/chrome-headless-shell",
  );
}
