export function parseVideoTime(text: string) {
  const match = /^(\d+):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(text.trim());
  if (!match) return NaN;
  return (
    Number(match[1]) * 60000 +
    Number(match[2]) * 1000 +
    Number((match[3] ?? "").padEnd(3, "0"))
  );
}
