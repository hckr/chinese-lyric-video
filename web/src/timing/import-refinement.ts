import type { Project } from "../domain.ts";
import { validateTimingResult } from "./automatic-timing.ts";
export type Edge = "startMs" | "endMs";
export const unresolvedCount = (p: Project) =>
  p.occurrences.reduce(
    (sum, o) => sum + Number(o.startMs === null) + Number(o.endMs === null),
    0,
  );
function info(p: Project, index: number) {
  const o = p.occurrences[index],
    text = p.phrases.find((ph) => ph.id === o?.phraseId)?.lyricKey;
  const piece = p.editionTiming?.pieces.find(
    (x) => x.id === o?.id && x.text === text,
  );
  // Earlier projects retained the cue index without a separate source-start field.
  const timing = p.editionTiming;
  const cue = piece && timing?.cues[piece.cue];
  if (
    piece &&
    cue &&
    piece.sourceStart === undefined &&
    piece.acceptStart === undefined &&
    cue.text.startsWith(piece.text) &&
    timing?.pieces.find((x) => x.cue === piece.cue)?.id === piece.id
  )
    return { o, text, piece: { ...piece, sourceStart: cue.startMs } };
  return { o, text, piece };
}
function anchor(p: Project, index: number) {
  const { o, piece } = info(p, index);
  return o?.startMs ?? piece?.sourceStart;
}
export function bounds(p: Project, i: number, edge: Edge, duration: number) {
  let left = 0,
    right = edge === "startMs" ? duration - 1 : duration;
  for (let j = i - 1; j >= 0; j--) {
    const a = p.occurrences[j].endMs ?? anchor(p, j);
    if (a != null) {
      left =
        a + (p.occurrences[j].endMs === null && edge === "startMs" ? 1 : 0);
      break;
    }
  }
  for (let j = i + 1; j < p.occurrences.length; j++) {
    const a = anchor(p, j) ?? p.occurrences[j].endMs;
    if (a != null) {
      right = a - (edge === "startMs" ? 1 : 0);
      break;
    }
  }
  const o = p.occurrences[i];
  if (edge === "endMs") left = Math.max(left, (anchor(p, i) ?? -1) + 1);
  else if (o.endMs !== null) right = Math.min(right, o.endMs - 1);
  return { left, right };
}
export function importSourceStarts(
  p: Project,
  duration: number,
  fingerprint: string,
) {
  if (p.editionTiming?.fingerprint !== fingerprint) return p.occurrences;
  return p.occurrences.map((o, i) => {
    const piece = info(p, i).piece,
      start = piece?.sourceStart;
    if (
      !piece?.acceptStart ||
      start === undefined ||
      o.startMs !== null ||
      start >= duration
    )
      return o;
    const range = bounds(p, i, "startMs", duration);
    if (start < range.left || start > range.right) return o;
    return { ...o, startMs: start };
  });
}
export function roughBoundary(
  p: Project,
  i: number,
  edge: Edge,
  duration: number,
) {
  const exact = edge === "startMs" ? info(p, i).piece?.sourceStart : undefined;
  const { left, right } = bounds(p, i, edge, duration);
  if (right < left) return;
  if (exact !== undefined && exact >= left && exact <= right)
    return { ms: exact, basis: "LRCLIB line start" };
  const weak = p.occurrences[i].weakTiming;
  if (weak?.matched && weak[edge] >= left && weak[edge] <= right)
    return { ms: weak[edge], basis: "Partial Whisper match" };
  const target = 2 * i + (edge === "endMs" ? 1 : 0);
  let weight = 0,
    targetWeight = 0;
  let before: { ms: number; weight: number } | undefined, after: typeof before;
  for (const [index, o] of p.occurrences.entries()) {
    const size = Math.max(
      1,
      Array.from(info(p, index).text ?? "").filter((c) =>
        /[\p{L}\p{N}]/u.test(c),
      ).length,
    );
    for (const [step, ms] of [anchor(p, index), o.endMs].entries()) {
      const at = 2 * index + step,
        w = weight + step * size;
      if (at === target) targetWeight = w;
      if (ms == null) continue;
      if (at < target) before = { ms, weight: w };
      if (at > target && !after) after = { ms, weight: w };
    }
    weight += size;
  }
  if (after?.weight === targetWeight && after.ms >= left && after.ms <= right)
    return { ms: after.ms, basis: "Next line starts here" };
  if (
    before?.weight === targetWeight &&
    before.ms >= left &&
    before.ms <= right
  )
    return { ms: before.ms, basis: "Previous line ends here" };
  if (
    !before ||
    !after ||
    after.weight <= before.weight ||
    after.ms <= before.ms
  )
    return;
  const ms = Math.round(
    before.ms +
      ((after.ms - before.ms) * (targetWeight - before.weight)) /
        (after.weight - before.weight),
  );
  if (ms >= left && ms <= right)
    return { ms, basis: "Estimated from lyric length" };
}

/** Applies previously saved, strong Whisper proposals from projects created
 * before imported timing became an automatic review step. */
export function acceptImportedRefinements(p: Project, duration: number) {
  let count = 0;
  const occurrences = p.occurrences.map((o, i) => {
    const { text } = info(p, i),
      proposal = o.refinement;
    if (!proposal || proposal.text !== text) return o;
    const patch: Partial<Pick<typeof o, "startMs" | "endMs">> = {};
    for (const edge of ["startMs", "endMs"] as const) {
      const value = proposal[edge];
      if (value === undefined || o[edge] !== null) continue;
      const range = bounds(p, i, edge, duration);
      if (value >= range.left && value <= range.right) patch[edge] = value;
    }
    const startMs = patch.startMs ?? o.startMs,
      endMs = patch.endMs ?? o.endMs;
    if (!Object.keys(patch).length) return o;
    count += Object.keys(patch).length;
    const { refinement: _refinement, ...withoutProposal } = o;
    return {
      ...withoutProposal,
      startMs,
      endMs,
      timingReview: "needs-review" as const,
      ...(startMs !== null && endMs !== null && endMs > startMs
        ? {
            automaticTiming: {
              startMs,
              endMs,
              runId: "import-refinement",
              reasons: ["Matched Whisper word edges"],
            },
          }
        : {}),
    };
  });
  return { project: count ? { ...p, occurrences } : p, count };
}
export function refineImported(p: Project, raw: unknown, duration: number) {
  const result = validateTimingResult(
    raw,
    p,
    p.occurrences.map((o) => o.id),
    duration,
  );
  let count = 0;
  const occurrences = p.occurrences.map((o, i) => {
    const line = result.lines[i],
      { piece, text } = info(p, i);
    if (
      !text ||
      o.timingReview === "reviewed" ||
      !line.refinementEvidence ||
      !line.total ||
      line.matched !== line.total ||
      line.reasons.length ||
      line.observedStartMs === undefined ||
      line.observedEndMs === undefined
    )
      return o;
    // A repeated phrase needs its own recording window to distinguish this appearance.
    const sourceCueIndex = piece?.cue ?? -1;
    const begin = p.editionTiming?.cues[sourceCueIndex]?.startMs,
      next = p.editionTiming?.cues
        .slice(sourceCueIndex + 1)
        .find((c) => begin !== undefined && c.startMs > begin)?.startMs;
    if (
      p.occurrences.filter((other) => other.phraseId === o.phraseId).length >
        1 &&
      (begin === undefined ||
        p.editionTiming?.pieces.some(
          (other) =>
            other.id !== o.id &&
            other.text === text &&
            other.cue === sourceCueIndex,
        ) ||
        line.observedStartMs < begin ||
        line.observedStartMs >= (next ?? duration))
    )
      return o;
    const proposal: { text: string; startMs?: number; endMs?: number } = {
      text,
    };
    for (const edge of ["startMs", "endMs"] as const) {
      const value =
        edge === "startMs" ? line.observedStartMs : line.observedEndMs;
      const { left, right } = bounds(p, i, edge, duration);
      if (
        (o.refinement?.text === text && o.refinement[edge] !== undefined) ||
        o[edge] !== null ||
        value < left ||
        value > right ||
        (edge === "startMs" &&
          (result.lines[i - 1]?.observedEndMs ?? 0) > value) ||
        (edge === "endMs" &&
          (result.lines[i + 1]?.observedStartMs ?? duration) < value) ||
        (edge === "startMs" &&
          piece?.sourceStart !== undefined &&
          piece.sourceStart >= left &&
          piece.sourceStart <= right)
      )
        continue;
      proposal[edge] = value;
    }
    if (proposal.startMs === undefined && proposal.endMs === undefined)
      return o;
    count +=
      Number(proposal.startMs !== undefined) +
      Number(proposal.endMs !== undefined);
    return { ...o, refinement: proposal };
  });
  const proposed = count ? { ...p, occurrences } : p;
  const accepted = acceptImportedRefinements(proposed, duration);
  return { project: accepted.project, count: accepted.count };
}
