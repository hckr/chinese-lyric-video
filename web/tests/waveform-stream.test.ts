import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkAudioBudget,
  peaksFromSamples,
} from "../src/timing/waveform-stream.ts";
function sample(channels: number[][], rate: number, timestamp: number) {
  let closed = false;
  return {
    numberOfChannels: channels.length,
    numberOfFrames: channels[0].length,
    sampleRate: rate,
    timestamp,
    copyTo(
      out: Float32Array,
      options: { planeIndex: number; frameOffset: number; frameCount: number },
    ) {
      assert.ok(out.length <= 4096);
      out.set(
        channels[options.planeIndex].slice(
          options.frameOffset,
          options.frameOffset + options.frameCount,
        ),
      );
    },
    close() {
      closed = true;
    },
    get closed() {
      return closed;
    },
  };
}
async function* stream(items: ReturnType<typeof sample>[]) {
  yield* items;
}
test("streamed peaks retain all channels, timestamps, gaps and final chunk samples", async () => {
  const first = sample(
      [
        [0.5, 0],
        [0, -0.8],
      ],
      2,
      0,
    ),
    last = sample([[0, 1]], 2, 2);
  const peaks = await peaksFromSamples(
    stream([first, last]),
    3000,
    new AbortController().signal,
  );
  assert.equal(peaks.length, 1600);
  assert.equal(peaks[0], 0.5);
  assert.equal(peaks[266], Math.fround(0.8));
  assert.equal(peaks[700], 0);
  assert.equal(peaks[1333], 1);
  assert.ok(first.closed && last.closed);
  const data = new Array(5000).fill(0);
  data[4999] = 1;
  const large = sample([data], 5000, 0);
  assert.equal(
    (
      await peaksFromSamples(
        stream([large]),
        1000,
        new AbortController().signal,
      )
    ).at(-1),
    1,
  );
});
test("budgets depend on audio work and reject invalid or excessive formats", () => {
  assert.doesNotThrow(() => checkAudioBudget(2, 48000, 210000));
  assert.throws(() => checkAudioBudget(8, 192000, 480000), /sample-processing/);
  assert.throws(() => checkAudioBudget(0, 48000, 1000));
  assert.throws(() => checkAudioBudget(2, NaN, 1000));
  assert.throws(() => checkAudioBudget(2, 48000, 481000), /eight-minute/);
});
test("cancellation and decoder failures release samples instead of publishing partial peaks", async () => {
  const controller = new AbortController(),
    one = sample([[1]], 1, 0);
  controller.abort();
  await assert.rejects(
    peaksFromSamples(stream([one]), 1000, controller.signal),
  );
  assert.ok(one.closed);
  const bad = sample([[1]], 1, 0);
  bad.copyTo = () => {
    throw Error("decode failed");
  };
  await assert.rejects(
    peaksFromSamples(stream([bad]), 1000, new AbortController().signal),
    /decode failed/,
  );
  assert.ok(bad.closed);
  await assert.rejects(
    peaksFromSamples(stream([]), 1000, new AbortController().signal),
    /no audio samples/,
  );
});

test("invalid media duration and pre-cancellation stop before opening any media bytes", async () => {
  const { decodeWaveform } = await import("../src/timing/waveform-stream.ts");
  const file = new File([], "unused.mp4");
  file.arrayBuffer = () => {
    throw Error("must not read the file");
  };
  await assert.rejects(
    decodeWaveform(file, Number.NaN, new AbortController().signal),
    /invalid media duration/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(decodeWaveform(file, 1000, controller.signal), {
    name: "AbortError",
  });
});

test("audio processing budget is independent of the video timeline duration", async () => {
  const one = sample([[1]], 1, 0);
  const peaks = await peaksFromSamples(
    stream([one]),
    9 * 60000,
    new AbortController().signal,
    1000,
  );
  assert.equal(peaks[0], 1);
  assert.ok(one.closed);
});
