/**
 * Convert millisecond timestamps to a Remotion Sequence start frame and
 * duration in frames, using the same rounding and 5-second fallback as all
 * four video compositions.
 */
export function msToFrameDuration(
  startMs: number,
  endMs: number,
  fps: number,
): { startFrame: number; duration: number } {
  const startFrame = Math.round((startMs / 1000) * fps);
  const endFrame = Math.round((endMs / 1000) * fps);
  const duration =
    endFrame > startFrame ? endFrame - startFrame : Math.round(fps * 5);
  return { startFrame, duration };
}
