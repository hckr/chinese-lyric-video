export function syntheticWav(seconds: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(44 + 32000 * seconds),
    view = new DataView(bytes.buffer);
  const ascii = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i);
  };
  ascii(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, bytes.length - 44, true);
  for (let i = 44; i < bytes.length; i += 2)
    view.setInt16(i, Math.round(Math.sin(i / 20) * 2000), true);
  return bytes;
}
