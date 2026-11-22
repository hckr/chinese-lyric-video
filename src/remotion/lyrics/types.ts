export type WordData = {
  hanzi: string;
  pinyin: string;
  translation: { en: string };
};

export type LineData = {
  id: string;
  words: WordData[];
  translation: { en: string; pl: string };
};

export type TimedLineData = LineData & {
  startMs: number;
  endMs: number;
};
