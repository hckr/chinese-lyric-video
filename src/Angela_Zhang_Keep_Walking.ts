// based on https://www.youtube.com/watch?v=WTcodZDH-Oc

const TIMELINE = [
  {
    id: "line-00",
    startMs: 10000,
    endMs: 15000,
    lyricKey: "Oh~人都应该有梦",
  },
  {
    id: "line-01",
    startMs: 15000,
    endMs: 19000,
    lyricKey: "有梦就别怕痛",
  },
  {
    id: "line-02",
    startMs: 19000,
    endMs: 22000,
    lyricKey: "有雷声在轰不停",
  },
  {
    id: "line-03",
    startMs: 22000,
    endMs: 24500,
    lyricKey: "雨泼进眼里看不清",
  },
  {
    id: "line-04",
    startMs: 24500,
    endMs: 26000,
    lyricKey: "谁急速狂飙",
  },
  {
    id: "line-04a",
    startMs: 26000,
    endMs: 29500,
    lyricKey: "溅我一身的泥泞",
  },
  {
    id: "line-05",
    startMs: 29500,
    endMs: 32000,
    lyricKey: "很确定我想去哪里",
  },
  {
    id: "line-06",
    startMs: 32000,
    endMs: 34500,
    lyricKey: "往天堂要跳过地狱",
  },
  {
    id: "line-07",
    startMs: 34500,
    endMs: 38000,
    lyricKey: "也不恐惧不逃避",
  },
  {
    id: "line-08",
    startMs: 38000,
    endMs: 41000,
    lyricKey: "这不是脾气",
  },
  {
    id: "line-08a",
    startMs: 41000,
    endMs: 44700,
    lyricKey: "是所谓志气(与勇气)",
  },
  {
    id: "line-09",
    startMs: 44700,
    endMs: 47000,
    lyricKey: "你能推我下悬崖",
  },
  {
    id: "line-09a",
    startMs: 47000,
    endMs: 49000,
    lyricKey: "我能学会飞行",
  },
  {
    id: "line-10",
    startMs: 49000,
    endMs: 53500,
    lyricKey: "从不听谁的命令",
  },
  {
    id: "line-10a",
    startMs: 53500,
    endMs: 55000,
    lyricKey: "(很独立)",
  },
  {
    id: "line-11",
    startMs: 55000,
    endMs: 59000,
    lyricKey: "耳朵用来听自己的心灵",
  },
  {
    id: "line-12",
    startMs: 59000,
    endMs: 62000,
    lyricKey: "淋雨一直走",
  },
  {
    id: "line-12a",
    startMs: 62000,
    endMs: 65000,
    lyricKey: "是一颗宝石就该闪烁",
  },
  {
    id: "line-13",
    startMs: 65000,
    endMs: 67500,
    lyricKey: "人都应该有梦Oh~",
  },
  {
    id: "line-13a",
    startMs: 67500,
    endMs: 69500,
    lyricKey: "有梦就别怕痛",
  },
  {
    id: "line-14",
    startMs: 69500,
    endMs: 72000,
    lyricKey: "淋雨一直走",
  },
  {
    id: "line-14a",
    startMs: 72000,
    endMs: 75000,
    lyricKey: "是道阳光就该暖和",
  },
  {
    id: "line-15",
    startMs: 75000,
    endMs: 77500,
    lyricKey: "人都应该有梦Oh~",
  },
  {
    id: "line-15a",
    startMs: 77500,
    endMs: 80000,
    lyricKey: "有梦就别怕痛",
  },
  {
    id: "line-16",
    startMs: 83000,
    endMs: 86000,
    lyricKey: "有前面盘旋的秃鹰",
  },
  {
    id: "line-17",
    startMs: 86000,
    endMs: 88500,
    lyricKey: "有背后尖酸的耳语",
  },
  {
    id: "line-18",
    startMs: 88500,
    endMs: 90000,
    lyricKey: "黑色的童话",
  },
  {
    id: "line-18a",
    startMs: 90000,
    endMs: 93500,
    lyricKey: "是给长大的洗礼",
  },
  {
    id: "line-19",
    startMs: 93500,
    endMs: 96000,
    lyricKey: "要独特才是流行",
  },
  {
    id: "line-20",
    startMs: 96000,
    endMs: 98500,
    lyricKey: "无法复制的自己",
  },
  {
    id: "line-21",
    startMs: 98500,
    endMs: 100000,
    lyricKey: "让我连受伤",
  },
  {
    id: "line-21a",
    startMs: 100000,
    endMs: 102000,
    lyricKey: "也有型",
  },
  {
    id: "line-22",
    startMs: 102000,
    endMs: 104500,
    lyricKey: "这不是脾气",
  },
  {
    id: "line-22a",
    startMs: 104500,
    endMs: 108500,
    lyricKey: "是所谓志气(与勇气)",
  },
  {
    id: "line-23",
    startMs: 108500,
    endMs: 111000,
    lyricKey: "你能推我下悬崖",
  },
  {
    id: "line-23a",
    startMs: 111000,
    endMs: 113000,
    lyricKey: "我能学会飞行",
  },
  {
    id: "line-24",
    startMs: 113000,
    endMs: 117500,
    lyricKey: "从不听谁的命令",
  },
  {
    id: "line-24a",
    startMs: 117500,
    endMs: 118500,
    lyricKey: "(很独立)",
  },
  {
    id: "line-25",
    startMs: 118500,
    endMs: 123000,
    lyricKey: "耳朵用来听自己的心灵",
  },
  {
    id: "line-26",
    startMs: 123000,
    endMs: 125500,
    lyricKey: "淋雨一直走",
  },
  {
    id: "line-26a",
    startMs: 125500,
    endMs: 128800,
    lyricKey: "是一颗宝石就该闪烁",
  },
  {
    id: "line-27",
    startMs: 128800,
    endMs: 131000,
    lyricKey: "人都应该有梦Oh~",
  },
  {
    id: "line-27a",
    startMs: 131000,
    endMs: 133000,
    lyricKey: "有梦就别怕痛",
  },
  {
    id: "line-28",
    startMs: 133000,
    endMs: 135500,
    lyricKey: "淋雨一直走",
  },
  {
    id: "line-28a",
    startMs: 135500,
    endMs: 139000,
    lyricKey: "是道阳光就该暖和",
  },
  {
    id: "line-29",
    startMs: 139000,
    endMs: 141500,
    lyricKey: "人都应该有梦Oh~",
  },
  {
    id: "line-29a",
    startMs: 141500,
    endMs: 144000,
    lyricKey: "有梦就别怕痛",
  },
  {
    id: "line-30",
    startMs: 144500,
    endMs: 147000,
    lyricKey: "有时掉进黑洞",
  },
  {
    id: "line-30a",
    startMs: 147000,
    endMs: 149500,
    lyricKey: "有时候爬上彩虹",
  },
  {
    id: "line-31",
    startMs: 149500,
    endMs: 151000,
    lyricKey: "在下一秒钟",
  },
  {
    id: "line-31a",
    startMs: 151000,
    endMs: 152500,
    lyricKey: "命运如何转动",
  },
  {
    id: "line-31b",
    startMs: 152500,
    endMs: 155000,
    lyricKey: "没有人会晓得Oh~",
  },
  {
    id: "line-32",
    startMs: 155000,
    endMs: 157500,
    lyricKey: "我说希望无穷",
  },
  {
    id: "line-32a",
    startMs: 157500,
    endMs: 160000,
    lyricKey: "你猜美梦成空",
  },
  {
    id: "line-33",
    startMs: 160000,
    endMs: 161500,
    lyricKey: "相信和怀疑",
  },
  {
    id: "line-33a",
    startMs: 161500,
    endMs: 166000,
    lyricKey: "总要决斗",
  },
  {
    id: "line-34",
    startMs: 166000,
    endMs: 169000,
    lyricKey: "淋雨一直走",
  },
  {
    id: "line-34a",
    startMs: 169000,
    endMs: 172000,
    lyricKey: "是一颗宝石就该闪烁",
  },
  {
    id: "line-35",
    startMs: 172000,
    endMs: 174500,
    lyricKey: "人都应该有梦Oh~",
  },
  {
    id: "line-35a",
    startMs: 174500,
    endMs: 176500,
    lyricKey: "有梦就别怕痛",
  },
  {
    id: "line-36",
    startMs: 176500,
    endMs: 179000,
    lyricKey: "淋雨一直走",
  },
  {
    id: "line-36a",
    startMs: 179000,
    endMs: 182000,
    lyricKey: "是道阳光就该暖和",
  },
  {
    id: "line-37",
    startMs: 182000,
    endMs: 184500,
    lyricKey: "人都应该有梦Oh~",
  },
  {
    id: "line-37a",
    startMs: 184500,
    endMs: 186500,
    lyricKey: "有梦就别怕痛",
  },
  {
    id: "line-38",
    startMs: 186500,
    endMs: 189500,
    lyricKey: "淋雨一直走",
  },
  {
    id: "line-38a",
    startMs: 189500,
    endMs: 192500,
    lyricKey: "是一颗宝石就该闪烁",
  },
  {
    id: "line-39",
    startMs: 192500,
    endMs: 195000,
    lyricKey: "人都应该有梦Oh~",
  },
  {
    id: "line-39a",
    startMs: 195000,
    endMs: 197000,
    lyricKey: "有梦就别怕痛",
  },
  {
    id: "line-40",
    startMs: 197000,
    endMs: 200000,
    lyricKey: "淋雨一直走",
  },
  {
    id: "line-40a",
    startMs: 200000,
    endMs: 203000,
    lyricKey: "是道阳光就该暖和",
  },
  {
    id: "line-41",
    startMs: 203000,
    endMs: 205500,
    lyricKey: "人都应该有梦Oh~",
  },
  {
    id: "line-41a",
    startMs: 205500,
    endMs: 208000,
    lyricKey: "有梦就别怕痛",
  },
] as const;

export default {
  title: "淋雨一直走",
  artist: "Angela Zhang",
  get lines() {
    return TIMELINE.map((item) => ({
      id: item.id,
      startMs: item.startMs,
      endMs: item.endMs,
      ...LYRICS_DICT[item.lyricKey],
    }));
  },
};

const 人都应该有梦_words = [
  {
    hanzi: "人",
    pinyin: "rén",
    translation: { en: "people" },
  },
  { hanzi: "都", pinyin: "dōu", translation: { en: "all" } },
  {
    hanzi: "应该",
    pinyin: "yīnggāi",
    translation: { en: "should" },
  },
  { hanzi: "有", pinyin: "yǒu", translation: { en: "to have" } },
  {
    hanzi: "梦",
    pinyin: "mèng",
    translation: { en: "dream" },
  },
];

const LYRICS_DICT = {
  "Oh~人都应该有梦": {
    translation: {
      en: "Oh, everyone should have dreams.",
      pl: "Ach, wszyscy powinni mieć marzenia.",
    },
    words: [
      { hanzi: "", pinyin: "", translation: { en: "Oh~" } },
      ...人都应该有梦_words,
    ],
  },
  有梦就别怕痛: {
    translation: {
      en: "Having dreams, don't be afraid of pain.",
      pl: "Mając marzenia, nie bać się bólu.",
    },
    words: [
      { hanzi: "", pinyin: "", translation: { en: "[if]" } },
      { hanzi: "有", pinyin: "yǒu", translation: { en: "have" } },
      {
        hanzi: "梦",
        pinyin: "mèng",
        translation: { en: "dream" },
      },
      {
        hanzi: "就",
        pinyin: "jiù",
        translation: { en: "then" },
      },
      {
        hanzi: "别",
        pinyin: "bié",
        translation: { en: "do not" },
      },
      {
        hanzi: "怕",
        pinyin: "pà",
        translation: { en: "to fear\nto be afraid" },
      },
      { hanzi: "痛", pinyin: "tòng", translation: { en: "pain" } },
    ],
  },
  有雷声在轰不停: {
    translation: {
      en: "The thunder rumbles constantly.",
      pl: "Grzmoty dudnią bez przerwy.",
    },
    words: [
      {
        hanzi: "有",
        pinyin: "yǒu",
        translation: { en: "there is" },
      },
      {
        hanzi: "雷声",
        pinyin: "léishēng",
        translation: { en: "sound of thunder" },
      },
      {
        hanzi: "在",
        pinyin: "zài",
        translation: { en: "(ongoing)" },
      },
      {
        hanzi: "轰",
        pinyin: "hōng",
        translation: { en: "to rumble\nto boom" },
      },
      {
        hanzi: "不停",
        pinyin: "bùtíng",
        translation: { en: "nonstop" },
      },
    ],
  },
  雨泼进眼里看不清: {
    translation: {
      en: "Rain splashes into my eyes, I can't see clearly.",
      pl: "Deszcz pryska mi w oczy, widzę niewyraźnie.",
    },
    words: [
      { hanzi: "雨", pinyin: "yǔ", translation: { en: "rain" } },
      {
        hanzi: "泼",
        pinyin: "pō",
        translation: { en: "to pour\nto splash" },
      },
      { hanzi: "进", pinyin: "jìn", translation: { en: "into\nin" } },
      {
        hanzi: "眼",
        pinyin: "yǎn",
        translation: { en: "eye" },
      },
      {
        hanzi: "里",
        pinyin: "lǐ",
        translation: { en: "inside" },
      },
      {
        hanzi: "看",
        pinyin: "kàn",
        translation: { en: "to look\nto see" },
      },
      {
        hanzi: "不清",
        pinyin: "bù qīng",
        translation: { en: "unclear" },
      },
    ],
  },
  谁急速狂飙: {
    translation: {
      en: "Who is speeding so madly,",
      pl: "Kto tak szaleńczo pędzi,",
    },
    words: [
      { hanzi: "谁", pinyin: "shéi", translation: { en: "who" } },
      {
        hanzi: "急速",
        pinyin: "jísù",
        translation: { en: "rapid\nhigh-speed" },
      },
      {
        hanzi: "狂",
        pinyin: "kuáng",
        translation: { en: "crazy\nwild" },
      },
      {
        hanzi: "飙",
        pinyin: "biāo",
        translation: { en: "to speed\nwhirlwind" },
      },
    ],
  },
  溅我一身的泥泞: {
    translation: {
      en: "splashing mud all over me?",
      pl: "ochlapując mnie całą błotem?",
    },
    words: [
      {
        hanzi: "溅",
        pinyin: "jiàn",
        translation: { en: "to splash\nto splatter" },
      },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "me" } },
      {
        hanzi: "一身",
        pinyin: "yīshēn",
        translation: { en: "whole body" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "泥泞",
        pinyin: "nínìng",
        translation: { en: "mud\nmire" },
      },
    ],
  },
  很确定我想去哪里: {
    translation: {
      en: "I'm very sure of where I want to go.",
      pl: "Jestem bardzo pewna, dokąd chcę iść.",
    },
    words: [
      { hanzi: "很", pinyin: "hěn", translation: { en: "very" } },
      {
        hanzi: "确定",
        pinyin: "quèdìng",
        translation: { en: "to be sure\nto determine\nsure" },
      },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "I" } },
      {
        hanzi: "想",
        pinyin: "xiǎng",
        translation: { en: "to want" },
      },
      { hanzi: "去", pinyin: "qù", translation: { en: "to go" } },
      {
        hanzi: "哪里",
        pinyin: "nǎlǐ",
        translation: { en: "where" },
      },
    ],
  },
  往天堂要跳过地狱: {
    translation: {
      en: "Going towards heaven, one must jump over hell.",
      pl: "Zmierzając do raju, trzeba przeskoczyć przez piekło.",
    },
    words: [
      {
        hanzi: "往",
        pinyin: "wǎng",
        translation: { en: "to head for\ntowards" },
      },
      {
        hanzi: "天堂",
        pinyin: "tiāntáng",
        translation: { en: "heaven" },
      },
      { hanzi: "要", pinyin: "yào", translation: { en: "must" } },
      {
        hanzi: "跳过",
        pinyin: "tiàoguò",
        translation: { en: "jump over" },
      },
      {
        hanzi: "地狱",
        pinyin: "dìyù",
        translation: { en: "hell" },
      },
    ],
  },
  也不恐惧不逃避: {
    translation: {
      en: "I'm neither afraid nor will I escape.",
      pl: "Nie boję się i nie uciekam.",
    },
    words: [
      {
        hanzi: "也",
        pinyin: "yě",
        translation: { en: "neither\nalso" },
      },
      { hanzi: "不", pinyin: "bù", translation: { en: "not" } },
      {
        hanzi: "恐惧",
        pinyin: "kǒngjù",
        translation: { en: "to fear\nfear" },
      },
      { hanzi: "不", pinyin: "bù", translation: { en: "not" } },
      {
        hanzi: "逃避",
        pinyin: "táobì",
        translation: { en: "to escape\nto avoid" },
      },
    ],
  },
  这不是脾气: {
    translation: {
      en: "This isn't temper.",
      pl: "To nie charakterek.",
    },
    words: [
      { hanzi: "这", pinyin: "zhè", translation: { en: "this" } },
      { hanzi: "不", pinyin: "bù", translation: { en: "not" } },
      { hanzi: "是", pinyin: "shì", translation: { en: "to be" } },
      {
        hanzi: "脾气",
        pinyin: "píqì",
        translation: { en: "temper" },
      },
    ],
  },
  "是所谓志气(与勇气)": {
    translation: {
      en: "It's called ambition (and courage).",
      pl: "To się nazywa ambicja (i odwaga).",
    },
    words: [
      { hanzi: "是", pinyin: "shì", translation: { en: "to be" } },
      {
        hanzi: "所谓",
        pinyin: "suǒwèi",
        translation: { en: "so-called\nwhat is known as" },
      },
      {
        hanzi: "志气",
        pinyin: "zhìqì",
        translation: { en: "ambition" },
      },
      { hanzi: "(与", pinyin: "(yǔ", translation: { en: "(and" } },
      {
        hanzi: "勇气)",
        pinyin: "yǒngqì)",
        translation: { en: "courage)" },
      },
    ],
  },
  你能推我下悬崖: {
    translation: {
      en: "You can push me off a cliff.",
      pl: "Możesz zepchnąć mnie w przepaść.",
    },
    words: [
      { hanzi: "你", pinyin: "nǐ", translation: { en: "you" } },
      { hanzi: "能", pinyin: "néng", translation: { en: "can\n(be able to)" } },
      { hanzi: "推", pinyin: "tuī", translation: { en: "to push" } },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "me" } },
      { hanzi: "下", pinyin: "xià", translation: { en: "down" } },
      {
        hanzi: "悬崖",
        pinyin: "xuányá",
        translation: { en: "cliff\nprecipice" },
      },
    ],
  },
  我能学会飞行: {
    translation: {
      en: "I can learn to fly.",
      pl: "Mogę nauczyć się latać.",
    },
    words: [
      { hanzi: "我", pinyin: "wǒ", translation: { en: "I" } },
      {
        hanzi: "能",
        pinyin: "néng",
        translation: { en: "can\n(be able to)" },
      },
      {
        hanzi: "学会",
        pinyin: "xuéhuì",
        translation: { en: "learn [how to]" },
      },
      {
        hanzi: "飞行",
        pinyin: "fēixíng",
        translation: { en: "to fly" },
      },
    ],
  },
  从不听谁的命令: {
    translation: {
      en: "I never listen to anyone's orders",
      pl: "Nigdy nie słucham czyichś rozkazów",
    },
    words: [
      {
        hanzi: "从不",
        pinyin: "cóngbù",
        translation: { en: "never" },
      },
      {
        hanzi: "听",
        pinyin: "tīng",
        translation: { en: "to listen\nto obey" },
      },
      {
        hanzi: "谁",
        pinyin: "shéi",
        translation: { en: "anyone" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "'s\n(particle)" },
      },
      {
        hanzi: "命令",
        pinyin: "mìnglìng",
        translation: { en: "order\ncommand" },
      },
    ],
  },
  "(很独立)": {
    translation: {
      en: "(very independent).",
      pl: "(bardzo niezależna).",
    },
    words: [
      {
        hanzi: "(很",
        pinyin: "(hěn",
        translation: { en: "(very" },
      },
      {
        hanzi: "独立)",
        pinyin: "dúlì)",
        translation: { en: "independent)" },
      },
    ],
  },
  耳朵用来听自己的心灵: {
    translation: {
      en: "Ears are for listening to one's own soul.",
      pl: "Uszy służą do słuchania własnej duszy.",
    },
    words: [
      {
        hanzi: "耳朵",
        pinyin: "ěrduo",
        translation: { en: "ears" },
      },
      {
        hanzi: "用来",
        pinyin: "yònglái",
        translation: { en: "to be used for\nto be used to" },
      },
      {
        hanzi: "听",
        pinyin: "tīng",
        translation: { en: "listen" },
      },
      {
        hanzi: "自己",
        pinyin: "zìjǐ",
        translation: { en: "oneself" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "'s\n(particle)" },
      },
      {
        hanzi: "心灵",
        pinyin: "xīnlíng",
        translation: { en: "psyche\nmind" },
      },
    ],
  },
  淋雨一直走: {
    translation: {
      en: "Keep moving forward, getting wet in the rain.",
      pl: "Iść wciąż naprzód, moknąc na deszczu.",
    },
    words: [
      {
        hanzi: "淋雨",
        pinyin: "línyǔ",
        translation: { en: "to get wet in the rain" },
      },
      {
        hanzi: "一直",
        pinyin: "yīzhí",
        translation: { en: "continuously\nalways" },
      },
      { hanzi: "走", pinyin: "zǒu", translation: { en: "to walk" } },
    ],
  },
  是一颗宝石就该闪烁: {
    translation: {
      en: "A gemstone ought to shine.",
      pl: "Klejnot powinien lśnić.",
    },
    words: [
      { hanzi: "", pinyin: "", translation: { en: "[if]" } },
      {
        hanzi: "是",
        pinyin: "shì",
        translation: { en: "to be" },
      },
      { hanzi: "一", pinyin: "yī", translation: { en: "a\none" } },
      {
        hanzi: "颗",
        pinyin: "kē",
        translation: { en: "(measure word)" },
      },
      {
        hanzi: "宝石",
        pinyin: "bǎoshí",
        translation: { en: "gemstone" },
      },
      { hanzi: "就", pinyin: "jiù", translation: { en: "then" } },
      {
        hanzi: "该",
        pinyin: "gāi",
        translation: { en: "should\nought to" },
      },
      {
        hanzi: "闪烁",
        pinyin: "shǎnshuò",
        translation: { en: "to glimmer\nto sparkle" },
      },
    ],
  },
  "人都应该有梦Oh~": {
    translation: {
      en: "Everyone should have dreams, oh.",
      pl: "Wszyscy powinni mieć marzenia, ach.",
    },
    words: [
      ...人都应该有梦_words,
      { hanzi: "", pinyin: "", translation: { en: "Oh~" } },
    ],
  },
  是道阳光就该暖和: {
    translation: {
      en: "A ray of sunlight ought to give warmth.",
      pl: "Promień słońca powinien dawać ciepło.",
    },
    words: [
      { hanzi: "", pinyin: "", translation: { en: "[if]" } },
      {
        hanzi: "是",
        pinyin: "shì",
        translation: { en: "to be" },
      },
      {
        hanzi: "道",
        pinyin: "dào",
        translation: { en: "(measure word)" },
      },
      {
        hanzi: "阳光",
        pinyin: "yángguāng",
        translation: { en: "sunlight" },
      },
      { hanzi: "就", pinyin: "jiù", translation: { en: "then" } },
      {
        hanzi: "该",
        pinyin: "gāi",
        translation: { en: "should\nought to" },
      },
      {
        hanzi: "暖和",
        pinyin: "nuǎnhuo",
        translation: { en: "to warm (up)\nwarm" },
      },
    ],
  },
  有前面盘旋的秃鹰: {
    translation: {
      en: "There are vultures circling ahead.",
      pl: "Przede mną krążą sępy.",
    },
    words: [
      {
        hanzi: "有",
        pinyin: "yǒu",
        translation: { en: "there is/are" },
      },
      {
        hanzi: "前面",
        pinyin: "qiánmiàn",
        translation: { en: "in front\nahead" },
      },
      {
        hanzi: "盘旋",
        pinyin: "pánxuán",
        translation: { en: "to circle\nto hover" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "秃鹰",
        pinyin: "tūyīng",
        translation: { en: "vulture" },
      },
    ],
  },
  有背后尖酸的耳语: {
    translation: {
      en: "There are caustic whispers behind my back.",
      pl: "Za plecami kąśliwe szepty.",
    },
    words: [
      {
        hanzi: "有",
        pinyin: "yǒu",
        translation: { en: "there are" },
      },
      {
        hanzi: "背后",
        pinyin: "bèihòu",
        translation: { en: "behind" },
      },
      {
        hanzi: "尖酸",
        pinyin: "jiānsuān",
        translation: { en: "caustic\nsarcastic" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "耳语",
        pinyin: "ěryǔ",
        translation: { en: "whisper" },
      },
    ],
  },
  黑色的童话: {
    translation: {
      en: "Dark fairy tales",
      pl: "Mroczne baśnie",
    },
    words: [
      {
        hanzi: "黑色",
        pinyin: "hēisè",
        translation: { en: "black" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "童话",
        pinyin: "tónghuà",
        translation: { en: "children's story\nfairy tale" },
      },
    ],
  },
  是给长大的洗礼: {
    translation: {
      en: "are the baptism for those who are growing up.",
      pl: "to chrzest dla tych, co dorastają.",
    },
    words: [
      { hanzi: "是", pinyin: "shì", translation: { en: "to be" } },
      {
        hanzi: "给",
        pinyin: "gěi",
        translation: { en: "for" },
      },
      {
        hanzi: "长大",
        pinyin: "zhǎngdà",
        translation: { en: "to grow up" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "洗礼",
        pinyin: "xǐlǐ",
        translation: { en: "baptism\nordeal" },
      },
    ],
  },
  要独特才是流行: {
    translation: {
      en: "To be truly in fashion means being unique.",
      pl: "Naprawdę modne jest to, co wyjątkowe.",
    },
    words: [
      {
        hanzi: "要",
        pinyin: "yào",
        translation: { en: "must [be]" },
      },
      {
        hanzi: "独特",
        pinyin: "dútè",
        translation: { en: "unique\ndistinctive" },
      },
      {
        hanzi: "才",
        pinyin: "cái",
        translation: { en: "only then\nonly" },
      },
      { hanzi: "是", pinyin: "shì", translation: { en: "to be" } },
      {
        hanzi: "流行",
        pinyin: "liúxíng",
        translation: { en: "fashionable\ntrendy\npopular" },
      },
    ],
  },
  无法复制的自己: {
    translation: {
      en: "A self that can't be duplicated",
      pl: '"Ja", którego nie można skopiować',
    },
    words: [
      {
        hanzi: "无法",
        pinyin: "wúfǎ",
        translation: { en: "unable to" },
      },
      {
        hanzi: "复制",
        pinyin: "fùzhì",
        translation: { en: "to duplicate" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "自己",
        pinyin: "zìjǐ",
        translation: { en: "self\noneself" },
      },
    ],
  },
  让我连受伤: {
    translation: {
      en: "makes me, even when I get hurt,",
      pl: "sprawia, że nawet zraniona,",
    },
    words: [
      {
        hanzi: "让",
        pinyin: "ràng",
        translation: { en: "to allow\nto let" },
      },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "me" } },
      { hanzi: "连", pinyin: "lián", translation: { en: "even" } },
      {
        hanzi: "受伤",
        pinyin: "shòushāng",
        translation: { en: "to be injured\nto get hurt" },
      },
    ],
  },
  也有型: {
    translation: {
      en: "still have style.",
      pl: "wciąż mam styl.",
    },
    words: [
      { hanzi: "也", pinyin: "yě", translation: { en: "also\ntoo" } },
      {
        hanzi: "有型",
        pinyin: "yǒuxíng",
        translation: { en: "stylish\nhave style" },
      },
    ],
  },
  有时掉进黑洞: {
    translation: {
      en: "Sometimes I fall into a black hole,",
      pl: "Czasem wpadam w czarną dziurę,",
    },
    words: [
      {
        hanzi: "有时",
        pinyin: "yǒushí",
        translation: { en: "sometimes" },
      },
      { hanzi: "掉", pinyin: "diào", translation: { en: "to fall" } },
      { hanzi: "进", pinyin: "jìn", translation: { en: "into" } },
      {
        hanzi: "黑洞",
        pinyin: "hēidòng",
        translation: { en: "black hole" },
      },
    ],
  },
  有时候爬上彩虹: {
    translation: {
      en: "sometimes I climb up a rainbow.",
      pl: "czasami wspinam się na tęczę.",
    },
    words: [
      {
        hanzi: "有时候",
        pinyin: "yǒushíhou",
        translation: { en: "sometimes" },
      },
      {
        hanzi: "爬",
        pinyin: "pá",
        translation: { en: "to climb" },
      },
      { hanzi: "上", pinyin: "shàng", translation: { en: "onto" } },
      {
        hanzi: "彩虹",
        pinyin: "cǎihóng",
        translation: { en: "rainbow" },
      },
    ],
  },
  在下一秒钟: {
    translation: {
      en: "In the very next second,",
      pl: "W następnej sekundzie,",
    },
    words: [
      { hanzi: "在", pinyin: "zài", translation: { en: "in\nduring" } },
      {
        hanzi: "下",
        pinyin: "xià",
        translation: { en: "next\nfollowing" },
      },
      { hanzi: "一", pinyin: "yī", translation: { en: "one" } },
      {
        hanzi: "秒钟",
        pinyin: "miǎozhōng",
        translation: { en: "second" },
      },
    ],
  },
  命运如何转动: {
    translation: {
      en: "how destiny will turn,",
      pl: "jak potoczy się los,",
    },
    words: [
      {
        hanzi: "命运",
        pinyin: "mìngyùn",
        translation: { en: "fate\ndestiny" },
      },
      {
        hanzi: "如何",
        pinyin: "rúhé",
        translation: { en: "how\n(in what way)" },
      },
      {
        hanzi: "转动",
        pinyin: "zhuǎndòng",
        translation: { en: "to turn\nto rotate\nto swivel" },
      },
    ],
  },
  "没有人会晓得Oh~": {
    translation: {
      en: "nobody knows, oh.",
      pl: "nikt nie wie, ach.",
    },
    words: [
      {
        hanzi: "没有",
        pinyin: "méiyǒu",
        translation: { en: "to not have\nthere is no" },
      },
      {
        hanzi: "人",
        pinyin: "rén",
        translation: { en: "person" },
      },
      { hanzi: "会", pinyin: "huì", translation: { en: "will\ncan" } },
      {
        hanzi: "晓得",
        pinyin: "xiǎode",
        translation: { en: "to know" },
      },
      { hanzi: "", pinyin: "", translation: { en: "Oh~" } },
    ],
  },
  我说希望无穷: {
    translation: {
      en: "I say that hope is boundless.",
      pl: "Mówię, że nadzieja jest nieograniczona.",
    },
    words: [
      { hanzi: "我", pinyin: "wǒ", translation: { en: "I" } },
      { hanzi: "说", pinyin: "shuō", translation: { en: "to say" } },
      {
        hanzi: "希望",
        pinyin: "xīwàng",
        translation: { en: "hope" },
      },
      {
        hanzi: "无穷",
        pinyin: "wúqióng",
        translation: { en: "to be endless\nto be boundless\ninfinite" },
      },
    ],
  },
  你猜美梦成空: {
    translation: {
      en: "You suppose sweet dreams will turn into nothing.",
      pl: "Myślisz, że piękne marzenia obrócą się wniwecz.",
    },
    words: [
      { hanzi: "你", pinyin: "nǐ", translation: { en: "you" } },
      {
        hanzi: "猜",
        pinyin: "cāi",
        translation: { en: "to guess\nto suppose" },
      },
      {
        hanzi: "美梦",
        pinyin: "měimèng",
        translation: { en: "good dream\nwish, desire\nsweet dreams" },
      },
      {
        hanzi: "成",
        pinyin: "chéng",
        translation: { en: "to become\nto turn into" },
      },
      {
        hanzi: "空",
        pinyin: "kōng",
        translation: { en: "empty\nvoid" },
      },
    ],
  },
  相信和怀疑: {
    translation: {
      en: "Belief and doubt",
      pl: "Wiara i zwątpienie",
    },
    words: [
      {
        hanzi: "相信",
        pinyin: "xiāngxìn",
        translation: { en: "belief\nto believe" },
      },
      { hanzi: "和", pinyin: "hé", translation: { en: "and" } },
      {
        hanzi: "怀疑",
        pinyin: "huáiyí",
        translation: { en: "doubt\nto doubt" },
      },
    ],
  },
  总要决斗: {
    translation: {
      en: "must always duel.",
      pl: "zawsze toczą pojedynek.",
    },
    words: [
      {
        hanzi: "总要",
        pinyin: "zǒngyào",
        translation: { en: "always must\ninevitably will" },
      },
      {
        hanzi: "决斗",
        pinyin: "juédòu",
        translation: { en: "to duel" },
      },
    ],
  },
} satisfies { [K in (typeof TIMELINE)[number]["lyricKey"]]: unknown };
