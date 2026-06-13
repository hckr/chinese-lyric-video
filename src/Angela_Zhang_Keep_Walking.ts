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
      { hanzi: "", pinyin: "", translation: { en: "Oh~", pl: "Ach~" } },
      {
        hanzi: "人",
        pinyin: "rén",
        translation: { en: "man", pl: "człowiek" },
      },
      { hanzi: "都", pinyin: "dōu", translation: { en: "all", pl: "każdy" } },
      {
        hanzi: "应该",
        pinyin: "yīnggāi",
        translation: { en: "should", pl: "powinien" },
      },
      { hanzi: "有", pinyin: "yǒu", translation: { en: "have", pl: "mieć" } },
      {
        hanzi: "梦",
        pinyin: "mèng",
        translation: { en: "dream", pl: "sen, marzenie" },
      },
    ],
  },
  有梦就别怕痛: {
    translation: {
      en: "if you have dreams, don't be afraid of pain.",
      pl: "mając marzenia, nie bój się bólu.",
    },
    words: [
      { hanzi: "有", pinyin: "yǒu", translation: { en: "have", pl: "mieć" } },
      {
        hanzi: "梦",
        pinyin: "mèng",
        translation: { en: "dream", pl: "marzenie" },
      },
      { hanzi: "就", pinyin: "jiù", translation: { en: "then", pl: "to" } },
      {
        hanzi: "别",
        pinyin: "bié",
        translation: { en: "do not", pl: "nie (rozkaz)" },
      },
      { hanzi: "怕", pinyin: "pà", translation: { en: "fear", pl: "bać się" } },
      { hanzi: "痛", pinyin: "tòng", translation: { en: "pain", pl: "ból" } },
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
        translation: { en: "be", pl: "być" },
      },
      {
        hanzi: "雷声",
        pinyin: "léishēng",
        translation: { en: "sound of thunder", pl: "odgłos grzmotu" },
      },
      {
        hanzi: "在",
        pinyin: "zài",
        translation: { en: "(ongoing)", pl: "(w trakcie)" },
      },
      {
        hanzi: "轰",
        pinyin: "hōng",
        translation: { en: "rumble", pl: "huczeć" },
      },
      {
        hanzi: "不停",
        pinyin: "bùtíng",
        translation: { en: "nonstop", pl: "bez przerwy" },
      },
    ],
  },
  雨泼进眼里看不清: {
    translation: {
      en: "Rain splashes into my eyes, making it impossible to see clearly.",
      pl: "Deszcz pryska w oczy, przez co nie widzę wyraźnie.",
    },
    words: [
      { hanzi: "雨", pinyin: "yǔ", translation: { en: "rain", pl: "deszcz" } },
      {
        hanzi: "泼",
        pinyin: "pō",
        translation: { en: "splash", pl: "pryskać" },
      },
      { hanzi: "进", pinyin: "jìn", translation: { en: "into", pl: "do" } },
      {
        hanzi: "眼里",
        pinyin: "yǎn lǐ",
        translation: { en: "inside the eyes", pl: "w oczy" },
      },
      {
        hanzi: "看",
        pinyin: "kàn",
        translation: { en: "look", pl: "patrzeć" },
      },
      {
        hanzi: "不清",
        pinyin: "bù qīng",
        translation: { en: "unclear", pl: "niewyraźnie" },
      },
    ],
  },
  谁急速狂飙: {
    translation: {
      en: "Someone speeds by wildly, splashing mud all over my body.",
      pl: "Ktoś pędzi z zawrotną prędkością, ochlapując całe moje ciało błotem.",
    },
    words: [
      { hanzi: "谁", pinyin: "shéi", translation: { en: "who", pl: "kto" } },
      {
        hanzi: "急速",
        pinyin: "jísù",
        translation: { en: "rapidly", pl: "gwałtownie" },
      },
      {
        hanzi: "狂飙",
        pinyin: "kuángbiāo",
        translation: { en: "speed wildly", pl: "pędzić" },
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
        translation: { en: "splash", pl: "ochlapać" },
      },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "me", pl: "mnie" } },
      {
        hanzi: "一身",
        pinyin: "yìshēn",
        translation: { en: "whole body", pl: "całe ciało" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "", pl: "" },
      },
      {
        hanzi: "泥泞",
        pinyin: "nínìng",
        translation: { en: "mud", pl: "błoto" },
      },
    ],
  },
  很确定我想去哪里: {
    translation: {
      en: "I am very sure of where I want to go.",
      pl: "Jestem bardzo pewien, dokąd chcę pójść.",
    },
    words: [
      { hanzi: "很", pinyin: "hěn", translation: { en: "very", pl: "bardzo" } },
      {
        hanzi: "确定",
        pinyin: "quèdìng",
        translation: { en: "certain", pl: "pewny" },
      },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "I", pl: "ja" } },
      {
        hanzi: "想",
        pinyin: "xiǎng",
        translation: { en: "want", pl: "chcieć" },
      },
      { hanzi: "去", pinyin: "qù", translation: { en: "go", pl: "iść" } },
      {
        hanzi: "哪里",
        pinyin: "nǎlǐ",
        translation: { en: "where", pl: "dokąd" },
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
        translation: { en: "towards", pl: "w stronę" },
      },
      {
        hanzi: "天堂",
        pinyin: "tiāntáng",
        translation: { en: "heaven", pl: "raj" },
      },
      { hanzi: "要", pinyin: "yào", translation: { en: "must", pl: "trzeba" } },
      {
        hanzi: "跳过",
        pinyin: "tiàoguò",
        translation: { en: "jump over", pl: "przeskoczyć" },
      },
      {
        hanzi: "地狱",
        pinyin: "dìyù",
        translation: { en: "hell", pl: "piekło" },
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
        translation: { en: "nevertheless", pl: "mimo to" },
      },
      { hanzi: "不", pinyin: "bù", translation: { en: "not", pl: "nie" } },
      {
        hanzi: "恐惧",
        pinyin: "kǒngjù",
        translation: { en: "fear", pl: "bać się" },
      },
      { hanzi: "不", pinyin: "bù", translation: { en: "not", pl: "nie" } },
      {
        hanzi: "逃避",
        pinyin: "táobì",
        translation: { en: "escape", pl: "uciekać" },
      },
    ],
  },
  这不是脾气: {
    translation: {
      en: "This is not a temper tantrum, it is the so-called ambition (and courage).",
      pl: "To nie są kaprysy, to tak zwana ambicja (i odwaga).",
    },
    words: [
      { hanzi: "这", pinyin: "zhè", translation: { en: "this", pl: "to" } },
      { hanzi: "不", pinyin: "bú", translation: { en: "not", pl: "nie" } },
      { hanzi: "是", pinyin: "shì", translation: { en: "is", pl: "jest" } },
      {
        hanzi: "脾气",
        pinyin: "píqì",
        translation: { en: "temper", pl: "kaprys" },
      },
    ],
  },
  "是所谓志气(与勇气)": {
    translation: {
      en: "This is not a temper tantrum, it is the so-called ambition (and courage).",
      pl: "To nie są kaprysy, to tak zwana ambicja (i odwaga).",
    },
    words: [
      { hanzi: "是", pinyin: "shì", translation: { en: "is", pl: "jest" } },
      {
        hanzi: "所谓",
        pinyin: "suǒwèi",
        translation: { en: "so-called", pl: "tak zwana" },
      },
      {
        hanzi: "志气",
        pinyin: "zhìqì",
        translation: { en: "ambition", pl: "ambicja" },
      },
      { hanzi: "(与", pinyin: "(yǔ", translation: { en: "(and", pl: "(i" } },
      {
        hanzi: "勇气)",
        pinyin: "yǒngqì)",
        translation: { en: "courage)", pl: "odwaga)" },
      },
    ],
  },
  你能推我下悬崖: {
    translation: {
      en: "You can push me off a cliff, but I can learn to fly.",
      pl: "Możesz zepchnąć mnie w przepaść, a ja potrafię nauczyć się latać.",
    },
    words: [
      { hanzi: "你", pinyin: "nǐ", translation: { en: "you", pl: "ty" } },
      { hanzi: "能", pinyin: "néng", translation: { en: "can", pl: "możesz" } },
      { hanzi: "推", pinyin: "tuī", translation: { en: "push", pl: "pchnąć" } },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "me", pl: "mnie" } },
      { hanzi: "下", pinyin: "xià", translation: { en: "down", pl: "w dół" } },
      {
        hanzi: "悬崖",
        pinyin: "xuányá",
        translation: { en: "cliff", pl: "przepaść" },
      },
    ],
  },
  我能学会飞行: {
    translation: {
      en: "You can push me off a cliff, but I can learn to fly.",
      pl: "Możesz zepchnąć mnie w przepaść, a ja potrafię nauczyć się latać.",
    },
    words: [
      { hanzi: "我", pinyin: "wǒ", translation: { en: "I", pl: "ja" } },
      {
        hanzi: "能",
        pinyin: "néng",
        translation: { en: "can", pl: "potrafię" },
      },
      {
        hanzi: "学会",
        pinyin: "xuéhuì",
        translation: { en: "learn", pl: "nauczyć się" },
      },
      {
        hanzi: "飞行",
        pinyin: "fēixíng",
        translation: { en: "flying", pl: "latać" },
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
        translation: { en: "never", pl: "nigdy nie" },
      },
      {
        hanzi: "听",
        pinyin: "tīng",
        translation: { en: "listen", pl: "słuchać" },
      },
      {
        hanzi: "谁",
        pinyin: "shéi",
        translation: { en: "who", pl: "kogoś" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)", pl: "(partykuła)" },
      },
      {
        hanzi: "命令",
        pinyin: "mìnglìng",
        translation: { en: "command", pl: "rozkaz" },
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
        translation: { en: "(very", pl: "(bardzo" },
      },
      {
        hanzi: "独立)",
        pinyin: "dúlì)",
        translation: { en: "independent)", pl: "niezależny)" },
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
        translation: { en: "ears", pl: "uszy" },
      },
      {
        hanzi: "用来",
        pinyin: "yònglái",
        translation: { en: "used for", pl: "służą do" },
      },
      {
        hanzi: "听",
        pinyin: "tīng",
        translation: { en: "listen", pl: "słuchania" },
      },
      {
        hanzi: "自己",
        pinyin: "zìjǐ",
        translation: { en: "oneself", pl: "własnej" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)", pl: "(partykuła)" },
      },
      {
        hanzi: "心灵",
        pinyin: "xīnlíng",
        translation: { en: "soul", pl: "duszy" },
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
        translation: { en: "walking in rain", pl: "iść w deszczu" },
      },
      {
        hanzi: "一直",
        pinyin: "yìzhí",
        translation: { en: "continuously", pl: "prosto" },
      },
      { hanzi: "走", pinyin: "zǒu", translation: { en: "walk", pl: "iść" } },
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
        translation: { en: "if one is", pl: "jeśli jest się" },
      },
      { hanzi: "一", pinyin: "yì", translation: { en: "one", pl: "jeden" } },
      {
        hanzi: "颗",
        pinyin: "kē",
        translation: { en: "(measure word)", pl: "(klasyfikator)" },
      },
      {
        hanzi: "宝石",
        pinyin: "bǎoshí",
        translation: { en: "gemstone", pl: "klejnot" },
      },
      { hanzi: "就", pinyin: "jiù", translation: { en: "then", pl: "to" } },
      {
        hanzi: "该",
        pinyin: "gāi",
        translation: { en: "should", pl: "powinien" },
      },
      {
        hanzi: "闪烁",
        pinyin: "shǎnshuò",
        translation: { en: "twinkle", pl: "lśnić" },
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
        translation: { en: "people", pl: "ludzie" },
      },
      { hanzi: "都", pinyin: "dōu", translation: { en: "all", pl: "wszyscy" } },
      {
        hanzi: "应该",
        pinyin: "yīnggāi",
        translation: { en: "should", pl: "powinni" },
      },
      { hanzi: "有", pinyin: "yǒu", translation: { en: "have", pl: "mieć" } },
      {
        hanzi: "梦",
        pinyin: "mèng",
        translation: { en: "dream", pl: "marzenie" },
      },
      { hanzi: "", pinyin: "", translation: { en: "Oh~", pl: "Ach~" } },
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
        translation: { en: "if one is", pl: "jeśli jest się" },
      },
      {
        hanzi: "道",
        pinyin: "dào",
        translation: { en: "(measure word)", pl: "(klasyfikator)" },
      },
      {
        hanzi: "阳光",
        pinyin: "yángguāng",
        translation: { en: "sunlight", pl: "słońce" },
      },
      { hanzi: "就", pinyin: "jiù", translation: { en: "then", pl: "to" } },
      {
        hanzi: "该",
        pinyin: "gāi",
        translation: { en: "should", pl: "powinien" },
      },
      {
        hanzi: "暖和",
        pinyin: "nuǎnhuo",
        translation: { en: "warm", pl: "ogrzewać" },
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
        translation: { en: "there are", pl: "są" },
      },
      {
        hanzi: "前面",
        pinyin: "qiánmiàn",
        translation: { en: "in front", pl: "z przodu" },
      },
      {
        hanzi: "盘旋",
        pinyin: "pánxuán",
        translation: { en: "hovering", pl: "krążące" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)", pl: "(partykuła)" },
      },
      {
        hanzi: "秃鹰",
        pinyin: "tūyīng",
        translation: { en: "vultures", pl: "sępy" },
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
        translation: { en: "there are", pl: "są" },
      },
      {
        hanzi: "背后",
        pinyin: "bèihòu",
        translation: { en: "behind the back", pl: "za plecami" },
      },
      {
        hanzi: "尖酸",
        pinyin: "jiānsuān",
        translation: { en: "caustic", pl: "kąśliwe" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)", pl: "(partykuła)" },
      },
      {
        hanzi: "耳语",
        pinyin: "ěryǔ",
        translation: { en: "whispers", pl: "szepty" },
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
        translation: { en: "dark", pl: "mroczne" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)", pl: "(partykuła)" },
      },
      {
        hanzi: "童话",
        pinyin: "tónghuà",
        translation: { en: "fairy tale", pl: "baśń" },
      },
    ],
  },
  是给长大的洗礼: {
    translation: {
      en: "Dark fairy tales are the baptism for growing up.",
      pl: "Mroczne baśnie to chrzest dorastania.",
    },
    words: [
      { hanzi: "是", pinyin: "shì", translation: { en: "is", pl: "jest" } },
      {
        hanzi: "给",
        pinyin: "gěi",
        translation: { en: "given to", pl: "dane" },
      },
      {
        hanzi: "长大",
        pinyin: "zhǎngdà",
        translation: { en: "growing up", pl: "dorastaniu" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)", pl: "(partykuła)" },
      },
      {
        hanzi: "洗礼",
        pinyin: "xǐlǐ",
        translation: { en: "baptism", pl: "chrzest" },
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
        translation: { en: "must be", pl: "trzeba" },
      },
      {
        hanzi: "独特",
        pinyin: "dútè",
        translation: { en: "unique", pl: "unikalnym" },
      },
      {
        hanzi: "才",
        pinyin: "cái",
        translation: { en: "only then", pl: "dopiero wtedy" },
      },
      { hanzi: "是", pinyin: "shì", translation: { en: "is", pl: "jest" } },
      {
        hanzi: "流行",
        pinyin: "liúxíng",
        translation: { en: "trendy", pl: "modne" },
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
        translation: { en: "unable to", pl: "niemożliwe aby" },
      },
      {
        hanzi: "复制",
        pinyin: "fùzhì",
        translation: { en: "duplicate", pl: "skopiować" },
      },
      {
        hanzi: "的",
        pinyin: "de",
        translation: { en: "(particle)", pl: "(partykuła)" },
      },
      {
        hanzi: "自己",
        pinyin: "zìjǐ",
        translation: { en: "oneself", pl: "samego siebie" },
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
        translation: { en: "makes", pl: "pozwala" },
      },
      { hanzi: "我", pinyin: "wǒ", translation: { en: "me", pl: "mi" } },
      { hanzi: "连", pinyin: "lián", translation: { en: "even", pl: "nawet" } },
      {
        hanzi: "受伤",
        pinyin: "shòushāng",
        translation: { en: "injured", pl: "bycie zranionym" },
      },
    ],
  },
  也有型: {
    translation: {
      en: "Makes me stylish even when I am hurt.",
      pl: "Sprawia, że nawet będąc rannym, mam styl.",
    },
    words: [
      { hanzi: "也", pinyin: "yě", translation: { en: "also", pl: "też" } },
      { hanzi: "有", pinyin: "yǒu", translation: { en: "have", pl: "mieć" } },
      { hanzi: "型", pinyin: "xíng", translation: { en: "style", pl: "styl" } },
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
        translation: { en: "sometimes", pl: "czasami" },
      },
      { hanzi: "掉", pinyin: "diào", translation: { en: "fall", pl: "spaść" } },
      { hanzi: "进", pinyin: "jìn", translation: { en: "into", pl: "do" } },
      {
        hanzi: "黑洞",
        pinyin: "hēidòng",
        translation: { en: "black hole", pl: "czarna dziura" },
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
        translation: { en: "sometimes", pl: "czasami" },
      },
      {
        hanzi: "爬",
        pinyin: "pá",
        translation: { en: "climb", pl: "wspinać się" },
      },
      { hanzi: "上", pinyin: "shàng", translation: { en: "onto", pl: "na" } },
      {
        hanzi: "彩虹",
        pinyin: "cǎihóng",
        translation: { en: "rainbow", pl: "tęcza" },
      },
    ],
  },
  在下一秒钟: {
    translation: {
      en: "In the very next second, how destiny will turn, nobody will know Oh~",
      pl: "W następnej sekundzie, jak potoczy się los, nikt nie będzie wiedział Oh~",
    },
    words: [
      { hanzi: "在", pinyin: "zài", translation: { en: "in", pl: "w" } },
      {
        hanzi: "下",
        pinyin: "xià",
        translation: { en: "next", pl: "następna" },
      },
      { hanzi: "一", pinyin: "yī", translation: { en: "one", pl: "jedna" } },
      {
        hanzi: "秒钟",
        pinyin: "miǎozhōng",
        translation: { en: "second", pl: "sekunda" },
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
        translation: { en: "fate", pl: "los" },
      },
      { hanzi: "如何", pinyin: "rúhé", translation: { en: "how", pl: "jak" } },
      {
        hanzi: "转动",
        pinyin: "zhuǎndòng",
        translation: { en: "turn", pl: "obróci się" },
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
        translation: { en: "no", pl: "nie ma" },
      },
      {
        hanzi: "人",
        pinyin: "rén",
        translation: { en: "person", pl: "człowiek" },
      },
      { hanzi: "会", pinyin: "huì", translation: { en: "will", pl: "będzie" } },
      {
        hanzi: "晓得",
        pinyin: "xiǎode",
        translation: { en: "know", pl: "wiedzieć" },
      },
      { hanzi: "", pinyin: "", translation: { en: "Oh~", pl: "Ach~" } },
    ],
  },
  我说希望无穷: {
    translation: {
      en: "I say hope is endless, you guess sweet dreams will come to nothing.",
      pl: "Ja mówię, że nadzieja jest nieskończona, ty zgadujesz, że piękne marzenia obrócą się wniwecz.",
    },
    words: [
      { hanzi: "我", pinyin: "wǒ", translation: { en: "I", pl: "ja" } },
      { hanzi: "说", pinyin: "shuō", translation: { en: "say", pl: "mówię" } },
      {
        hanzi: "希望",
        pinyin: "xīwàng",
        translation: { en: "hope", pl: "nadzieja" },
      },
      {
        hanzi: "无穷",
        pinyin: "wúqióng",
        translation: { en: "infinite", pl: "nieskończona" },
      },
    ],
  },
  你猜美梦成空: {
    translation: {
      en: "I say hope is endless, you guess sweet dreams will come to nothing.",
      pl: "Ja mówię, że nadzieja jest nieskończona, ty zgadujesz, że piękne marzenia obrócą się wniwecz.",
    },
    words: [
      { hanzi: "你", pinyin: "nǐ", translation: { en: "you", pl: "ty" } },
      {
        hanzi: "猜",
        pinyin: "cāi",
        translation: { en: "guess", pl: "zgadujesz" },
      },
      {
        hanzi: "美梦",
        pinyin: "měimèng",
        translation: { en: "sweet dreams", pl: "piękne marzenia" },
      },
      {
        hanzi: "成",
        pinyin: "chéng",
        translation: { en: "become", pl: "stają się" },
      },
      {
        hanzi: "空",
        pinyin: "kōng",
        translation: { en: "empty", pl: "nicością" },
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
        translation: { en: "belief", pl: "wiara" },
      },
      { hanzi: "和", pinyin: "hé", translation: { en: "and", pl: "i" } },
      {
        hanzi: "怀疑",
        pinyin: "huáiyí",
        translation: { en: "doubt", pl: "zwątpienie" },
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
        translation: { en: "always", pl: "zawsze" },
      },
      {
        hanzi: "要",
        pinyin: "yào",
        translation: { en: "must", pl: "będą musiały" },
      },
      {
        hanzi: "决斗",
        pinyin: "juédòu",
        translation: { en: "duel", pl: "walczyć" },
      },
    ],
  },
} satisfies { [K in (typeof TIMELINE)[number]["lyricKey"]]: unknown };
