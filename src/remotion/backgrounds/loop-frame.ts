export function loopFrame(
  frame: number,
  length: number,
  mode: "once" | "repeat" | "ping-pong",
) {
  if (length <= 1) return 0;
  if (mode === "once") return Math.min(frame, length - 1);
  if (mode === "repeat") return frame % length;
  const period = 2 * (length - 1);
  const step = frame % period;
  return Math.min(step, period - step);
}
