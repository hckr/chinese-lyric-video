export const headerFields = {
  title: "Title",
  artist: "Performer",
} as const;

type Field = keyof typeof headerFields;

const labels: [Field[], RegExp][] = [
  [["title"], /^(?:歌名|曲名|title|song title)$/iu],
  [["artist"], /^(?:演唱|原唱|歌手|唱|主唱|artist|performer|vocals)$/iu],
];

const creditLabel =
  /^(?:词曲|詞曲|词曲作者|詞曲作者|词|詞|作词|作詞|填词|填詞|歌词作者|歌詞作者|曲|作曲|编曲|編曲|words and music|lyrics by|lyricist|music by|composer|arranged by|arranger)$/iu;

export function lyricHeaders(lines: { text: string }[]) {
  const values: Partial<Record<Field, string>> = {};
  const ambiguous = new Set<Field>();
  const header = lines
    .map((line) => line.text.trim())
    .filter((line) => line && !/^\[[^[\]]+\]$/u.test(line))
    .slice(0, 8);
  for (const [index, line] of header.entries()) {
    const labeled = /^([^:：]+)[:：]\s*(.+)$/u.exec(line);
    if (!labeled) {
      if (index === 0 && /^(?:《[^》]+》|〈[^〉]+〉)$/u.test(line))
        values.title = line.slice(1, -1).trim();
      else if (
        index > 0 ||
        !labels.some(([, pattern]) =>
          pattern.test(header[1]?.split(/[:：]/u)[0].trim() ?? ""),
        )
      )
        break;
      else if (!line.includes("[") && !line.includes("]")) values.title = line;
      else break;
      continue;
    }
    const label = labels.find(([, pattern]) => pattern.test(labeled[1].trim()));
    if (!label) {
      if (creditLabel.test(labeled[1].trim())) continue;
      break;
    }
    const value = labeled[2].trim();
    if (!value) continue;
    for (const field of label[0]) {
      if (values[field] && values[field] !== value) ambiguous.add(field);
      values[field] = value;
    }
  }
  return (Object.keys(values) as Field[])
    .filter((field) => !ambiguous.has(field) && values[field])
    .map((field) => ({ field, value: values[field]! }));
}
