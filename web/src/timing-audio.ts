/** Decode the linked media without changing the file used by playback. */
export async function timingWav(
  file: File,
  signal: AbortSignal,
): Promise<Blob> {
  const input = await file.arrayBuffer();
  signal.throwIfAborted();
  const decoded = await new OfflineAudioContext(1, 1, 16000).decodeAudioData(
    input,
  );
  signal.throwIfAborted();
  if (!decoded.length || decoded.length > 480 * 16000)
    throw Error("Timing supports audio up to eight minutes.");
  const context = new OfflineAudioContext(1, decoded.length, 16000);
  const source = context.createBufferSource();
  source.buffer = decoded;
  source.connect(context.destination);
  source.start();
  const samples = (await context.startRendering()).getChannelData(0);
  signal.throwIfAborted();

  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const header = new DataView(bytes);
  const tag = (at: number, value: string) => {
    for (const [index, char] of [...value].entries())
      header.setUint8(at + index, char.charCodeAt(0));
  };
  tag(0, "RIFF");
  header.setUint32(4, bytes.byteLength - 8, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, 16000, true);
  header.setUint32(28, 32000, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  tag(36, "data");
  header.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) =>
    header.setInt16(
      44 + index * 2,
      Math.max(-32768, Math.min(32767, Math.round(sample * 32768))),
      true,
    ),
  );
  return new Blob([bytes], { type: "audio/wav" });
}
