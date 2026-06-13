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
    endMs: 22500,
    lyricKey: "有雷声在轰不停",
  },
  {
    id: "line-03",
    startMs: 22500,
    endMs: 24500,
    lyricKey: "雨泼进眼里看不清",
  },
  {
    id: "line-04",
    startMs: 25000,
    endMs: 26000,
    lyricKey: "谁急速狂飙",
  },
  {
    id: "line-04a",
    startMs: 26000,
    endMs: 30000,
    lyricKey: "溅我一身的泥泞",
  },
  {
    id: "line-05",
    startMs: 30000,
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
    endMs: 44500,
    lyricKey: "是所谓志气(与勇气)",
  },
  {
    id: "line-09",
    startMs: 44500,
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
    endMs: 70000,
    lyricKey: "有梦就别怕痛",
  },
  {
    id: "line-14",
    startMs: 70000,
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
    startMs: 82500,
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
    endMs: 110500,
    lyricKey: "你能推我下悬崖",
  },
  {
    id: "line-23a",
    startMs: 110500,
    endMs: 113000,
    lyricKey: "我能学会飞行",
  },
  {
    id: "line-24",
    startMs: 113000,
    endMs: 117000,
    lyricKey: "从不听谁的命令",
  },
  {
    id: "line-24a",
    startMs: 117000,
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
    endMs: 128500,
    lyricKey: "是一颗宝石就该闪烁",
  },
  {
    id: "line-27",
    startMs: 128500,
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
    endMs: 167000,
    lyricKey: "总要决斗",
  },
  {
    id: "line-34",
    startMs: 167000,
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
    endMs: 189000,
    lyricKey: "淋雨一直走",
  },
  {
    id: "line-38a",
    startMs: 189000,
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
    endMs: 196500,
    lyricKey: "有梦就别怕痛",
  },
  {
    id: "line-40",
    startMs: 197500,
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

const LYRICS_DICT = {
  "Oh~人都应该有梦": {
    translation: {
      en: "Oh, everyone should have dreams",
      pl: "Ach, wszyscy powinni mieć marzenia",
    },
    words: [
      { hanzi: "", pinyin: "", translation: { en: "Oh~" } },
      {
        hanzi: "人",
        pinyin: "rén",
        translation: { en: "man" },
      },
      { hanzi: "都", pinyin: "dōu", translation: { en: "all" } },
      {
        hanzi: "应该",
        pinyin: "yīnggāi",
        translation: { en: "should" },
      },
      { hanzi: "有", pinyin: "yǒu", translation: { en: "have" } },
      {
        hanzi: "梦",
        pinyin: "mèng",
        translation: { en: "dream" },
      },
    ],
  },
  有梦就别怕痛: {
    translation: {
      en: "if you have dreams, don't be afraid of pain.",
      pl: "mając marzenia, nie bój się bólu.",
    },
    words: [
      { hanzi: "有", pinyin: "yǒu", translation: { en: "have" } },
      {
        hanzi: "梦",
        pinyin: "mèng",
        translation: { en: "dream" },
      },
      { hanzi: "就", pinyin: "jiù", translation: { en: "then" } },
      {
        hanzi: "别",
        pinyin: "bié",
        translation: { en: "do not" },
      },
      { hanzi: "怕", pinyin: "pà", translation: { en: "fear" } },
      { hanzi: "痛", pinyin: "tòng", translation: { en: "pain" } },
    ],
  },
  有雷声在轰不停: {
    translation: {
      en: "There is the sound of thunder rumbling endlessly.",
      pl: "Słychać nieustannie dudniące grzmoty.",
    },
    words: [
      {
        hanzi: "有",
        pinyin: "yǒu",
        translation: { en: "be" },
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
        translation: { en: "rumble" },
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
      en: "Rain splashes into my eyes, making it impossible to see clearly.",
      pl: "Deszcz pryska w oczy, przez co nie widzę wyraźnie.",
    },
    words: [
      { hanzi: "雨", pinyin: "yǔ", translation: { en: "rain" } },
      {
        hanzi: "泼",
        pinyin: "pō",
        translation: { en: "splash" },
      },
      { hanzi: "进", pinyin: "jìn", translation: { en: "into" } },
      {
        hanzi: "眼里",
        pinyin: "yǎn lǐ",
        translation: { en: "inside the eyes" },
      },
      {
        hanzi: "看",
        pinyin: "kàn",
        translation: { en: "look" },
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
      en: "Someone speeds by wildly, splashing mud all over my body.",
      pl: "Ktoś pędzi z zawrotną prędkością, ochlapując całe moje ciało błotem.",
    },
    words: [
      { hanzi: "谁", pinyin: "shéi", translation: { en: "who" } },
      {
        hanzi: "急速",
        pinyin: "jísù",
        translation: { en: "rapidly" },
      },
      {
        hanzi: "狂飙",
        pinyin: "kuángbiāo",
        translation: { en: "speed wildly" },
      },
    ],
  },
  溅我一身的泥泞: {
    translation: {
      en: "Someone speeds by wildly, splashing mud all over my body.",
      pl: "Ktoś pędzi z zawrotną prędkością, ochlapując całe moje ciało błotem.",
    },
    words: [
      {
        hanzi: "溅",
        pinyin: "jiàn",
        translation: { en: "splash" },
      },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "me" } },
      {
        hanzi: "一身",
        pinyin: "yìshēn",
        translation: { en: "whole body" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "" },
      },
      {
        hanzi: "泥泞",
        pinyin: "nínìng",
        translation: { en: "mud" },
      },
    ],
  },
  很确定我想去哪里: {
    translation: {
      en: "I am very sure of where I want to go.",
      pl: "Jestem bardzo pewien, dokąd chcę pójść.",
    },
    words: [
      { hanzi: "很", pinyin: "hěn", translation: { en: "very" } },
      {
        hanzi: "确定",
        pinyin: "quèdìng",
        translation: { en: "certain" },
      },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "I" } },
      {
        hanzi: "想",
        pinyin: "xiǎng",
        translation: { en: "want" },
      },
      { hanzi: "去", pinyin: "qù", translation: { en: "go" } },
      {
        hanzi: "哪里",
        pinyin: "nǎlǐ",
        translation: { en: "where" },
      },
    ],
  },
  往天堂要跳过地狱: {
    translation: {
      en: "To head towards heaven, one must jump over hell.",
      pl: "Aby zmierzać do raju, trzeba przeskoczyć przez piekło.",
    },
    words: [
      {
        hanzi: "往",
        pinyin: "wǎng",
        translation: { en: "towards" },
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
      en: "I am neither afraid nor will I escape.",
      pl: "Nie boję się i nie uciekam.",
    },
    words: [
      {
        hanzi: "也",
        pinyin: "yě",
        translation: { en: "nevertheless" },
      },
      { hanzi: "不", pinyin: "bù", translation: { en: "not" } },
      {
        hanzi: "恐惧",
        pinyin: "kǒngjù",
        translation: { en: "fear" },
      },
      { hanzi: "不", pinyin: "bù", translation: { en: "not" } },
      {
        hanzi: "逃避",
        pinyin: "táobì",
        translation: { en: "escape" },
      },
    ],
  },
  这不是脾气: {
    translation: {
      en: "This is not a temper tantrum, it is the so-called ambition (and courage).",
      pl: "To nie są kaprysy, to tak zwana ambicja (i odwaga).",
    },
    words: [
      { hanzi: "这", pinyin: "zhè", translation: { en: "this" } },
      { hanzi: "不", pinyin: "bú", translation: { en: "not" } },
      { hanzi: "是", pinyin: "shì", translation: { en: "is" } },
      {
        hanzi: "脾气",
        pinyin: "píqì",
        translation: { en: "temper" },
      },
    ],
  },
  "是所谓志气(与勇气)": {
    translation: {
      en: "This is not a temper tantrum, it is the so-called ambition (and courage).",
      pl: "To nie są kaprysy, to tak zwana ambicja (i odwaga).",
    },
    words: [
      { hanzi: "是", pinyin: "shì", translation: { en: "is" } },
      {
        hanzi: "所谓",
        pinyin: "suǒwèi",
        translation: { en: "so-called" },
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
      en: "You can push me off a cliff, but I can learn to fly.",
      pl: "Możesz zepchnąć mnie w przepaść, a ja potrafię nauczyć się latać.",
    },
    words: [
      { hanzi: "你", pinyin: "nǐ", translation: { en: "you" } },
      { hanzi: "能", pinyin: "néng", translation: { en: "can" } },
      { hanzi: "推", pinyin: "tuī", translation: { en: "push" } },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "me" } },
      { hanzi: "下", pinyin: "xià", translation: { en: "down" } },
      {
        hanzi: "悬崖",
        pinyin: "xuányá",
        translation: { en: "cliff" },
      },
    ],
  },
  我能学会飞行: {
    translation: {
      en: "You can push me off a cliff, but I can learn to fly.",
      pl: "Możesz zepchnąć mnie w przepaść, a ja potrafię nauczyć się latać.",
    },
    words: [
      { hanzi: "我", pinyin: "wǒ", translation: { en: "I" } },
      {
        hanzi: "能",
        pinyin: "néng",
        translation: { en: "can" },
      },
      {
        hanzi: "学会",
        pinyin: "xuéhuì",
        translation: { en: "learn" },
      },
      {
        hanzi: "飞行",
        pinyin: "fēixíng",
        translation: { en: "flying" },
      },
    ],
  },
  从不听谁的命令: {
    translation: {
      en: "I never listen to anyone's orders (very independent).",
      pl: "Nigdy nie słucham czyichś rozkazów (bardzo niezależny).",
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
        translation: { en: "listen" },
      },
      {
        hanzi: "谁",
        pinyin: "shéi",
        translation: { en: "who" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "命令",
        pinyin: "mìnglìng",
        translation: { en: "command" },
      },
    ],
  },
  "(很独立)": {
    translation: {
      en: "I never listen to anyone's orders (very independent).",
      pl: "Nigdy nie słucham czyichś rozkazów (bardzo niezależny).",
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
      en: "Ears are used to listen to one's own soul.",
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
        translation: { en: "used for" },
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
        translation: { en: "(particle)" },
      },
      {
        hanzi: "心灵",
        pinyin: "xīnlíng",
        translation: { en: "soul" },
      },
    ],
  },
  淋雨一直走: {
    translation: {
      en: "Keep walking in the rain; if you are a jewel, you should shine.",
      pl: "Idę prosto przed siebie w deszczu; jeśli jesteś klejnotem, powinieneś lśnić.",
    },
    words: [
      {
        hanzi: "淋雨",
        pinyin: "línyǔ",
        translation: { en: "walking in rain" },
      },
      {
        hanzi: "一直",
        pinyin: "yìzhí",
        translation: { en: "continuously" },
      },
      { hanzi: "走", pinyin: "zǒu", translation: { en: "walk" } },
    ],
  },
  是一颗宝石就该闪烁: {
    translation: {
      en: "Keep walking in the rain; if you are a jewel, you should shine.",
      pl: "Idę prosto przed siebie w deszczu; jeśli jesteś klejnotem, powinieneś lśnić.",
    },
    words: [
      {
        hanzi: "是",
        pinyin: "shì",
        translation: { en: "if one is" },
      },
      { hanzi: "一", pinyin: "yì", translation: { en: "one" } },
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
        translation: { en: "should" },
      },
      {
        hanzi: "闪烁",
        pinyin: "shǎnshuò",
        translation: { en: "twinkle" },
      },
    ],
  },
  "人都应该有梦Oh~": {
    translation: {
      en: "Everyone should have dreams; if you have dreams, don't be afraid of pain.",
      pl: "Wszyscy ludzie powinni mieć marzenia; mając marzenia, nie bój się bólu.",
    },
    words: [
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
      { hanzi: "有", pinyin: "yǒu", translation: { en: "have" } },
      {
        hanzi: "梦",
        pinyin: "mèng",
        translation: { en: "dream" },
      },
      { hanzi: "", pinyin: "", translation: { en: "Oh~" } },
    ],
  },
  是道阳光就该暖和: {
    translation: {
      en: "Keep walking in the rain; if you are a ray of sunlight, you should give warmth.",
      pl: "Idę prosto przed siebie w deszczu; jeśli jesteś promieniem słońca, powinieneś ogrzewać.",
    },
    words: [
      {
        hanzi: "是",
        pinyin: "shì",
        translation: { en: "if one is" },
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
        translation: { en: "should" },
      },
      {
        hanzi: "暖和",
        pinyin: "nuǎnhuo",
        translation: { en: "warm" },
      },
    ],
  },
  有前面盘旋的秃鹰: {
    translation: {
      en: "There are vultures circling ahead.",
      pl: "Z przodu krążą sępy.",
    },
    words: [
      {
        hanzi: "有",
        pinyin: "yǒu",
        translation: { en: "there are" },
      },
      {
        hanzi: "前面",
        pinyin: "qiánmiàn",
        translation: { en: "in front" },
      },
      {
        hanzi: "盘旋",
        pinyin: "pánxuán",
        translation: { en: "hovering" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "秃鹰",
        pinyin: "tūyīng",
        translation: { en: "vultures" },
      },
    ],
  },
  有背后尖酸的耳语: {
    translation: {
      en: "There are caustic whispers behind my back.",
      pl: "Za plecami słychać kąśliwe szepty.",
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
        translation: { en: "behind the back" },
      },
      {
        hanzi: "尖酸",
        pinyin: "jiānsuān",
        translation: { en: "caustic" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "耳语",
        pinyin: "ěryǔ",
        translation: { en: "whispers" },
      },
    ],
  },
  黑色的童话: {
    translation: {
      en: "Dark fairy tales are the baptism for growing up.",
      pl: "Mroczne baśnie to chrzest dorastania.",
    },
    words: [
      {
        hanzi: "黑色",
        pinyin: "hēisè",
        translation: { en: "dark" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "童话",
        pinyin: "tónghuà",
        translation: { en: "fairy tale" },
      },
    ],
  },
  是给长大的洗礼: {
    translation: {
      en: "Dark fairy tales are the baptism for growing up.",
      pl: "Mroczne baśnie to chrzest dorastania.",
    },
    words: [
      { hanzi: "是", pinyin: "shì", translation: { en: "is" } },
      {
        hanzi: "给",
        pinyin: "gěi",
        translation: { en: "given to" },
      },
      {
        hanzi: "长大",
        pinyin: "zhǎngdà",
        translation: { en: "growing up" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "洗礼",
        pinyin: "xǐlǐ",
        translation: { en: "baptism" },
      },
    ],
  },
  要独特才是流行: {
    translation: {
      en: "Being unique is what is truly in fashion.",
      pl: "Bycie unikalnym to prawdziwa moda.",
    },
    words: [
      {
        hanzi: "要",
        pinyin: "yào",
        translation: { en: "must be" },
      },
      {
        hanzi: "独特",
        pinyin: "dútè",
        translation: { en: "unique" },
      },
      {
        hanzi: "才",
        pinyin: "cái",
        translation: { en: "only then" },
      },
      { hanzi: "是", pinyin: "shì", translation: { en: "is" } },
      {
        hanzi: "流行",
        pinyin: "liúxíng",
        translation: { en: "trendy" },
      },
    ],
  },
  无法复制的自己: {
    translation: {
      en: "An uncopyable self.",
      pl: 'Niemożliwe do skopiowania "ja".',
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
        translation: { en: "duplicate" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)" },
      },
      {
        hanzi: "自己",
        pinyin: "zìjǐ",
        translation: { en: "oneself" },
      },
    ],
  },
  让我连受伤: {
    translation: {
      en: "Makes me stylish even when I am hurt.",
      pl: "Sprawia, że nawet będąc rannym, mam styl.",
    },
    words: [
      {
        hanzi: "让",
        pinyin: "ràng",
        translation: { en: "makes" },
      },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "me" } },
      { hanzi: "连", pinyin: "lián", translation: { en: "even" } },
      {
        hanzi: "受伤",
        pinyin: "shòushāng",
        translation: { en: "injured" },
      },
    ],
  },
  也有型: {
    translation: {
      en: "Makes me stylish even when I am hurt.",
      pl: "Sprawia, że nawet będąc rannym, mam styl.",
    },
    words: [
      { hanzi: "也", pinyin: "yě", translation: { en: "also" } },
      { hanzi: "有", pinyin: "yǒu", translation: { en: "have" } },
      { hanzi: "型", pinyin: "xíng", translation: { en: "style" } },
    ],
  },
  有时掉进黑洞: {
    translation: {
      en: "Sometimes falling into a black hole, sometimes climbing onto a rainbow.",
      pl: "Czasami wpadając do czarnej dziury, czasami wspinając się na tęczę.",
    },
    words: [
      {
        hanzi: "有时",
        pinyin: "yǒushí",
        translation: { en: "sometimes" },
      },
      { hanzi: "掉", pinyin: "diào", translation: { en: "fall" } },
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
      en: "Sometimes falling into a black hole, sometimes climbing onto a rainbow.",
      pl: "Czasami wpadając do czarnej dziury, czasami wspinając się na tęczę.",
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
        translation: { en: "climb" },
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
      en: "In the very next second, how destiny will turn, nobody will know Oh~",
      pl: "W następnej sekundzie, jak potoczy się los, nikt nie będzie wiedział Oh~",
    },
    words: [
      { hanzi: "在", pinyin: "zài", translation: { en: "in" } },
      {
        hanzi: "下",
        pinyin: "xià",
        translation: { en: "next" },
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
      en: "In the very next second, how destiny will turn, nobody will know Oh~",
      pl: "W następnej sekundzie, jak potoczy się los, nikt nie będzie wiedział Oh~",
    },
    words: [
      {
        hanzi: "命运",
        pinyin: "mìngyùn",
        translation: { en: "fate" },
      },
      { hanzi: "如何", pinyin: "rúhé", translation: { en: "how" } },
      {
        hanzi: "转动",
        pinyin: "zhuǎndòng",
        translation: { en: "turn" },
      },
    ],
  },
  "没有人会晓得Oh~": {
    translation: {
      en: "In the very next second, how destiny will turn, nobody will know Oh~",
      pl: "W następnej sekundzie, jak potoczy się los, nikt nie będzie wiedział Oh~",
    },
    words: [
      {
        hanzi: "没有",
        pinyin: "méiyǒu",
        translation: { en: "no" },
      },
      {
        hanzi: "人",
        pinyin: "rén",
        translation: { en: "person" },
      },
      { hanzi: "会", pinyin: "huì", translation: { en: "will" } },
      {
        hanzi: "晓得",
        pinyin: "xiǎode",
        translation: { en: "know" },
      },
      { hanzi: "", pinyin: "", translation: { en: "Oh~" } },
    ],
  },
  我说希望无穷: {
    translation: {
      en: "I say hope is endless, you guess sweet dreams will come to nothing.",
      pl: "Ja mówię, że nadzieja jest nieskończona, ty zgadujesz, że piękne marzenia obrócą się wniwecz.",
    },
    words: [
      { hanzi: "我", pinyin: "wǒ", translation: { en: "I" } },
      { hanzi: "说", pinyin: "shuō", translation: { en: "say" } },
      {
        hanzi: "希望",
        pinyin: "xīwàng",
        translation: { en: "hope" },
      },
      {
        hanzi: "无穷",
        pinyin: "wúqióng",
        translation: { en: "infinite" },
      },
    ],
  },
  你猜美梦成空: {
    translation: {
      en: "I say hope is endless, you guess sweet dreams will come to nothing.",
      pl: "Ja mówię, że nadzieja jest nieskończona, ty zgadujesz, że piękne marzenia obrócą się wniwecz.",
    },
    words: [
      { hanzi: "你", pinyin: "nǐ", translation: { en: "you" } },
      {
        hanzi: "猜",
        pinyin: "cāi",
        translation: { en: "guess" },
      },
      {
        hanzi: "美梦",
        pinyin: "měimèng",
        translation: { en: "sweet dreams" },
      },
      {
        hanzi: "成",
        pinyin: "chéng",
        translation: { en: "become" },
      },
      {
        hanzi: "空",
        pinyin: "kōng",
        translation: { en: "empty" },
      },
    ],
  },
  相信和怀疑: {
    translation: {
      en: "Belief and doubt will always have to duel.",
      pl: "Wiara i zwątpienie zawsze będą musiały walczyć.",
    },
    words: [
      {
        hanzi: "相信",
        pinyin: "xiāngxìn",
        translation: { en: "belief" },
      },
      { hanzi: "和", pinyin: "hé", translation: { en: "and" } },
      {
        hanzi: "怀疑",
        pinyin: "huáiyí",
        translation: { en: "doubt" },
      },
    ],
  },
  总要决斗: {
    translation: {
      en: "Belief and doubt will always have to duel.",
      pl: "Wiara i zwątpienie zawsze będą musiały walczyć.",
    },
    words: [
      {
        hanzi: "总",
        pinyin: "zǒng",
        translation: { en: "always" },
      },
      {
        hanzi: "要",
        pinyin: "yào",
        translation: { en: "must" },
      },
      {
        hanzi: "决斗",
        pinyin: "juédòu",
        translation: { en: "duel" },
      },
    ],
  },
} satisfies { [K in (typeof TIMELINE)[number]["lyricKey"]]: unknown };
