// based on https://www.youtube.com/watch?v=Ed2zO87Xk1U

const TIMELINE = [
  {
    id: "line-00",
    startMs: 1000,
    endMs: 8500,
    lyricKey: "对你专属的偏爱",
  },
  {
    id: "line-01",
    startMs: 9000,
    endMs: 12000,
    lyricKey: "你应付着周围",
  },
  {
    id: "line-02",
    startMs: 12000,
    endMs: 14500,
    lyricKey: "礼貌又带着防备",
  },
  {
    id: "line-03",
    startMs: 14500,
    endMs: 16500,
    lyricKey: "眼神却总在追",
  },
  {
    id: "line-04",
    startMs: 16500,
    endMs: 19500,
    lyricKey: "我所在的方位",
  },
  {
    id: "line-05",
    startMs: 19500,
    endMs: 21500,
    lyricKey: "你嘴角的倾斜",
  },
  {
    id: "line-06",
    startMs: 21500,
    endMs: 24000,
    lyricKey: "只有我能察觉",
  },
  {
    id: "line-07",
    startMs: 24000,
    endMs: 26000,
    lyricKey: "这默契太体贴",
  },
  {
    id: "line-08",
    startMs: 26000,
    endMs: 30000,
    lyricKey: "像专属的情节",
  },
  {
    id: "line-09",
    startMs: 30000,
    endMs: 35500,
    lyricKey: "全世界我只接受你的偏爱",
  },
  {
    id: "line-10",
    startMs: 35500,
    endMs: 40000,
    lyricKey: "你是我的专属和例外",
  },
  {
    id: "line-11",
    startMs: 40000,
    endMs: 44000,
    lyricKey: "这感觉不用向谁去坦白",
  },
  {
    id: "line-12",
    startMs: 44000,
    endMs: 49500,
    lyricKey: "心照不宣是我唯一的依赖",
  },
  {
    id: "line-09a",
    startMs: 49500,
    endMs: 55000,
    lyricKey: "全世界我只接受你的偏爱",
  },
  {
    id: "line-10a",
    startMs: 55000,
    endMs: 59500,
    lyricKey: "你是我的专属和例外",
  },
  {
    id: "line-11a",
    startMs: 59500,
    endMs: 63500,
    lyricKey: "这感觉不用向谁去坦白",
  },
  {
    id: "line-12a",
    startMs: 63500,
    endMs: 69000,
    lyricKey: "心照不宣是我唯一的依赖",
  },
  {
    id: "line-14",
    startMs: 90000,
    endMs: 92500,
    lyricKey: "你嘴角的倾斜",
  },
  {
    id: "line-15",
    startMs: 92500,
    endMs: 95000,
    lyricKey: "只有我能察觉",
  },
  {
    id: "line-16",
    startMs: 95000,
    endMs: 97000,
    lyricKey: "这默契太体贴",
  },
  {
    id: "line-17",
    startMs: 97000,
    endMs: 101000,
    lyricKey: "像专属的情节",
  },
  {
    id: "line-18",
    startMs: 101000,
    endMs: 106500,
    lyricKey: "全世界我只接受你的偏爱",
  },
  {
    id: "line-19",
    startMs: 106500,
    endMs: 111000,
    lyricKey: "你是我的专属和例外",
  },
  {
    id: "line-20",
    startMs: 111000,
    endMs: 115000,
    lyricKey: "这感觉不用向谁去坦白",
  },
  {
    id: "line-21",
    startMs: 115000,
    endMs: 121000,
    lyricKey: "心照不宣是我唯一的依赖",
  },
  {
    id: "line-22",
    startMs: 121000,
    endMs: 123500,
    lyricKey: "不是炫耀或姿态",
  },
  {
    id: "line-23",
    startMs: 123500,
    endMs: 126000,
    lyricKey: "是确信你一定会在",
  },
  {
    id: "line-24",
    startMs: 126000,
    endMs: 128500,
    lyricKey: "穿越过人山人海",
  },
  {
    id: "line-25",
    startMs: 128500,
    endMs: 133000,
    lyricKey: "只为我而来",
  },
  {
    id: "line-26",
    startMs: 133000,
    endMs: 138500,
    lyricKey: "全世界我只接受你的偏爱",
  },
  {
    id: "line-27",
    startMs: 138500,
    endMs: 143000,
    lyricKey: "你是我的专属和例外",
  },
  {
    id: "line-28",
    startMs: 143000,
    endMs: 147000,
    lyricKey: "这感觉不用向谁去坦白",
  },
  {
    id: "line-29",
    startMs: 147000,
    endMs: 152500,
    lyricKey: "心照不宣是我唯一的依赖",
  },
  {
    id: "line-26a",
    startMs: 152500,
    endMs: 158000,
    lyricKey: "全世界我只接受你的偏爱",
  },
  {
    id: "line-27a",
    startMs: 158000,
    endMs: 162500,
    lyricKey: "你是我的专属和例外",
  },
  {
    id: "line-28a",
    startMs: 162500,
    endMs: 166500,
    lyricKey: "这感觉不用向谁去坦白",
  },
  {
    id: "line-29a",
    startMs: 166500,
    endMs: 172000,
    lyricKey: "心照不宣是我唯一的依赖",
  },
] as const;

export default {
  title: "对你专属的偏爱",
  artist: "Macchiato",
  get lines() {
    return TIMELINE.map((item) => ({
      id: item.id,
      startMs: item.startMs,
      endMs: item.endMs,
      ...LYRICS_DICT[item.lyricKey],
    }));
  },
};

const LYRICS_DICT = {
  对你专属的偏爱: {
    translation: {
      en: "Special affection exclusive to you",
      pl: "Wyjątkowa sympatia zarezerwowana dla ciebie",
    },
    words: [
      { hanzi: "对", pinyin: "duì", translation: { en: "towards\nto" } },
      { hanzi: "你", pinyin: "nǐ", translation: { en: "you" } },
      { hanzi: "专属", pinyin: "zhuānshǔ", translation: { en: "exclusive" } },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "[attributive particle]" },
      },
      {
        hanzi: "偏爱",
        pinyin: "piān'ài",
        translation: { en: "special affection\nfavoritism" },
      },
    ],
  },
  你应付着周围: {
    translation: {
      en: "You deal with your surroundings",
      pl: "Radzisz sobie z otoczeniem",
    },
    words: [
      { hanzi: "你", pinyin: "nǐ", translation: { en: "you" } },
      {
        hanzi: "应付",
        pinyin: "yìngfu",
        translation: { en: "to deal with\nto cope" },
      },
      {
        hanzi: "着",
        pinyin: "zhe",
        translation: { en: "[particle indicating continuous action]" },
      },
      {
        hanzi: "周围",
        pinyin: "zhōuwéi",
        translation: { en: "surroundings\naround" },
      },
    ],
  },
  礼貌又带着防备: {
    translation: {
      en: "Polite yet with a touch of guardedness",
      pl: "Uprzejmie, lecz z nutą rezerwy",
    },
    words: [
      {
        hanzi: "礼貌",
        pinyin: "lǐmào",
        translation: { en: "polite\npoliteness" },
      },
      { hanzi: "又", pinyin: "yòu", translation: { en: "yet\nand" } },
      { hanzi: "带", pinyin: "dài", translation: { en: "to bring\nto carry" } },
      {
        hanzi: "着",
        pinyin: "zhe",
        translation: { en: "[particle indicating continuous action]" },
      },
      {
        hanzi: "防备",
        pinyin: "fángbèi",
        translation: { en: "guardedness\nprecaution" },
      },
    ],
  },
  眼神却总在追: {
    translation: {
      en: "But your eyes are always chasing",
      pl: "Ale twoje spojrzenie zawsze podąża",
    },
    words: [
      {
        hanzi: "眼神",
        pinyin: "yǎnshén",
        translation: { en: "look\nexpression in the eyes" },
      },
      { hanzi: "却", pinyin: "què", translation: { en: "but\nhowever" } },
      { hanzi: "总", pinyin: "zǒng", translation: { en: "always" } },
      {
        hanzi: "在",
        pinyin: "zài",
        translation: { en: "[indicating an action in progress]" },
      },
      {
        hanzi: "追",
        pinyin: "zhuī",
        translation: { en: "to chase\nto pursue" },
      },
    ],
  },
  我所在的方位: {
    translation: {
      en: "The direction where I am",
      pl: "W kierunku, w którym się znajduję",
    },
    words: [
      { hanzi: "我", pinyin: "wǒ", translation: { en: "I\nme" } },
      {
        hanzi: "所在",
        pinyin: "suǒzài",
        translation: { en: "place where something is\nlocation" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "[possessive particle]" },
      },
      {
        hanzi: "方位",
        pinyin: "fāngwèi",
        translation: { en: "direction\nposition" },
      },
    ],
  },
  你嘴角的倾斜: {
    translation: {
      en: "The tilt of the corner of your mouth",
      pl: "Uniesienie kącika twoich ust",
    },
    words: [
      { hanzi: "你", pinyin: "nǐ", translation: { en: "your\nyou" } },
      {
        hanzi: "嘴角",
        pinyin: "zuǐjiǎo",
        translation: { en: "corner of the mouth" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "[possessive particle]" },
      },
      {
        hanzi: "倾斜",
        pinyin: "qīngxié",
        translation: { en: "tilt\nincline" },
      },
    ],
  },
  只有我能察觉: {
    translation: {
      en: "Only I can notice",
      pl: "Tylko ja potrafię to dostrzec",
    },
    words: [
      { hanzi: "只有", pinyin: "zhǐyǒu", translation: { en: "only" } },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "I\nme" } },
      {
        hanzi: "能",
        pinyin: "néng",
        translation: { en: "can\nto be able to" },
      },
      {
        hanzi: "察觉",
        pinyin: "chájué",
        translation: { en: "to notice\nto perceive" },
      },
    ],
  },
  这默契太体贴: {
    translation: {
      en: "This tacit understanding is so considerate",
      pl: "To milczące porozumienie jest tak troskliwe",
    },
    words: [
      { hanzi: "这", pinyin: "zhè", translation: { en: "this" } },
      {
        hanzi: "默契",
        pinyin: "mòqì",
        translation: { en: "tacit understanding\nunspoken consensus" },
      },
      { hanzi: "太", pinyin: "tài", translation: { en: "too\nextremely" } },
      {
        hanzi: "体贴",
        pinyin: "tǐtiē",
        translation: { en: "considerate\nthoughtful" },
      },
    ],
  },
  像专属的情节: {
    translation: {
      en: "Like an exclusive plotline",
      pl: "Jak zarezerwowany tylko dla nas scenariusz",
    },
    words: [
      {
        hanzi: "像",
        pinyin: "xiàng",
        translation: { en: "like\nto resemble" },
      },
      { hanzi: "专属", pinyin: "zhuānshǔ", translation: { en: "exclusive" } },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "[attributive particle]" },
      },
      { hanzi: "情节", pinyin: "qíngjié", translation: { en: "plot\nstory" } },
    ],
  },
  全世界我只接受你的偏爱: {
    translation: {
      en: "In the whole world, I only accept your special affection",
      pl: "Na całym świecie przyjmuję tylko twoje wyjątkowe względy",
    },
    words: [
      { hanzi: "全", pinyin: "quán", translation: { en: "whole\nentire" } },
      { hanzi: "世界", pinyin: "shìjiè", translation: { en: "world" } },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "I" } },
      { hanzi: "只", pinyin: "zhǐ", translation: { en: "only" } },
      { hanzi: "接受", pinyin: "jiēshòu", translation: { en: "to accept" } },
      { hanzi: "你", pinyin: "nǐ", translation: { en: "your\nyou" } },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "偏爱",
        pinyin: "piān'ài",
        translation: { en: "special affection\npreference" },
      },
    ],
  },
  你是我的专属和例外: {
    translation: {
      en: "You are my exclusive one and exception",
      pl: "Jesteś moją wyłącznością i wyjątkiem",
    },
    words: [
      { hanzi: "你", pinyin: "nǐ", translation: { en: "you" } },
      { hanzi: "是", pinyin: "shì", translation: { en: "are\nto be" } },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "my\nme" } },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "[possessive particle]" },
      },
      { hanzi: "专属", pinyin: "zhuānshǔ", translation: { en: "exclusive" } },
      { hanzi: "和", pinyin: "hé", translation: { en: "and" } },
      { hanzi: "例外", pinyin: "lìwài", translation: { en: "exception" } },
    ],
  },
  这感觉不用向谁去坦白: {
    translation: {
      en: "There is no need to confess this feeling to anyone",
      pl: "Tego uczucia nie trzeba nikomu wyznawać",
    },
    words: [
      { hanzi: "这", pinyin: "zhè", translation: { en: "this" } },
      { hanzi: "感觉", pinyin: "gǎnjué", translation: { en: "feeling" } },
      { hanzi: "不", pinyin: "bù", translation: { en: "not" } },
      { hanzi: "用", pinyin: "yòng", translation: { en: "need\nto use" } },
      { hanzi: "向", pinyin: "xiàng", translation: { en: "towards\nto" } },
      { hanzi: "谁", pinyin: "shéi", translation: { en: "who\nanyone" } },
      {
        hanzi: "去",
        pinyin: "qù",
        translation: { en: "to go\n[auxiliary word]" },
      },
      {
        hanzi: "坦白",
        pinyin: "tǎnbái",
        translation: { en: "to confess\nto be frank" },
      },
    ],
  },
  心照不宣是我唯一的依赖: {
    translation: {
      en: "A mutual understanding without words is my only reliance",
      pl: "Porozumienie bez słów to moje jedyne oparcie",
    },
    words: [
      {
        hanzi: "心照不宣",
        pinyin: "xīnzhàobùxuān",
        translation: { en: "tacit mutual understanding" },
      },
      { hanzi: "是", pinyin: "shì", translation: { en: "is\nto be" } },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "my\nI" } },
      { hanzi: "唯一", pinyin: "wéiyī", translation: { en: "only\nsole" } },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "依赖",
        pinyin: "yīlài",
        translation: { en: "reliance\ndependence" },
      },
    ],
  },
  不是炫耀或姿态: {
    translation: {
      en: "It is not a show-off or a posture",
      pl: "To nie są przechwałki ani poza",
    },
    words: [
      { hanzi: "不", pinyin: "bù", translation: { en: "not" } },
      { hanzi: "是", pinyin: "shì", translation: { en: "is" } },
      {
        hanzi: "炫耀",
        pinyin: "xuànyào",
        translation: { en: "to show off\nto flaunt" },
      },
      { hanzi: "或", pinyin: "huò", translation: { en: "or" } },
      {
        hanzi: "姿态",
        pinyin: "zītài",
        translation: { en: "posture\nstance" },
      },
    ],
  },
  是确信你一定会在: {
    translation: {
      en: "It is the certainty that you will definitely be there",
      pl: "To pewność, że na pewno tu będziesz",
    },
    words: [
      { hanzi: "是", pinyin: "shì", translation: { en: "is" } },
      {
        hanzi: "确信",
        pinyin: "quèxìn",
        translation: { en: "certainty\nto be convinced" },
      },
      { hanzi: "你", pinyin: "nǐ", translation: { en: "you" } },
      {
        hanzi: "一定",
        pinyin: "yīdìng",
        translation: { en: "definitely\ncertainly" },
      },
      { hanzi: "会", pinyin: "huì", translation: { en: "will" } },
      {
        hanzi: "在",
        pinyin: "zài",
        translation: { en: "to be present\nto exist" },
      },
    ],
  },
  穿越过人山人海: {
    translation: {
      en: "Crossing through seas of people",
      pl: "Przemierzając morze ludzi",
    },
    words: [
      {
        hanzi: "穿越",
        pinyin: "chuānyuè",
        translation: { en: "to cross\nto pass through" },
      },
      {
        hanzi: "过",
        pinyin: "guò",
        translation: { en: "[experiential particle]" },
      },
      {
        hanzi: "人山人海",
        pinyin: "rénshānrénhǎi",
        translation: { en: "sea of people\nhuge crowds" },
      },
    ],
  },
  只为我而来: {
    translation: {
      en: "Coming only for me",
      pl: "Przybywając tylko dla mnie",
    },
    words: [
      { hanzi: "只", pinyin: "zhǐ", translation: { en: "only" } },
      { hanzi: "为", pinyin: "wèi", translation: { en: "for" } },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "me" } },
      { hanzi: "而", pinyin: "ér", translation: { en: "[conjunction]" } },
      { hanzi: "来", pinyin: "lái", translation: { en: "to come" } },
    ],
  },
} as unknown; //satisfies { [K in (typeof TIMELINE)[number]["lyricKey"]]: unknown };
