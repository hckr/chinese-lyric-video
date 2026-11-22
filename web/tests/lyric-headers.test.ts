import assert from "node:assert/strict";
import test from "node:test";
import { lyricHeaders } from "../src/lyric-headers.ts";

test("pasted headers yield local metadata suggestions without editing the source", () => {
  const lines = [
    "《風雨》",
    "演唱：小貓",
    "詞曲：林",
    "编曲：陳",
    "這是歌詞",
    "演唱：別人",
  ].map((text) => ({ text }));
  assert.deepEqual(lyricHeaders(lines), [
    { field: "title", value: "風雨" },
    { field: "artist", value: "小貓" },
  ]);
  assert.deepEqual(
    lyricHeaders([
      { text: "[Verse]" },
      ...lines.slice(0, 1),
      { text: "[/]" },
      ...lines.slice(1),
    ]),
    lyricHeaders(lines),
  );
  assert.equal(lines.length, 6);
  assert.deepEqual(lyricHeaders([{ text: "第一句" }, { text: "第二句" }]), []);
  assert.deepEqual(
    lyricHeaders([{ text: "演唱：甲" }, { text: "演唱：乙" }]),
    [],
  );
});
