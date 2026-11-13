"""Validate vocabulary against the source without generating pronunciation."""
import re
import unicodedata
from .pinyin import normalize

HANZI = re.compile(r'[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\U00020000-\U0003134f]')
SYLLABLES = set('''a ai an ang ao ba bai ban bang bao bei ben beng bi bian biao bie bin bing bo bu
ca cai can cang cao ce cen ceng cha chai chan chang chao che chen cheng chi chong chou chu chua chuai chuan chuang chui chun chuo ci cong cou cu cuan cui cun cuo
da dai dan dang dao de dei den deng di dia dian diao die ding diu dong dou du duan dui dun duo e ei en eng er
fa fan fang fei fen feng fo fou fu ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo
ha hai han hang hao he hei hen heng hm hng hong hou hu hua huai huan huang hui hun huo
ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo
la lai lan lang lao le lei len leng li lia lian liang liao lie lin ling liu lo long lou lu luan lun luo lü lüe
m ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu
n na nai nan nang nao ne nei nen neng ng ni nia nian niang niao nie nin ning niu nong nou nu nuan nuo nü nüe o ou
pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu
qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun r ran rang rao re ren reng ri rong rou ru ruan rui run ruo
sa sai san sang sao se sen seng sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo si song sou su suan sui sun suo
ta tai tan tang tao te teng ti tian tiao tie ting tong tou tu tuan tui tun tuo
wa wai wan wang wei wen weng wo wu xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun
ya yan yang yao ye yi yin ying yo yong you yu yuan yue yun
za zai zan zang zao ze zei zen zeng zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo zi zong zou zu zuan zui zun zuo'''.split())
PLACEHOLDERS = {'pinyin', 'pronunciation', 'hanzi', 'unknown', 'none', 'null', 'todo', 'placeholder'}


def syllable_counts(value):
    """Possible syllable counts, retaining tone marks as syllable constraints."""
    value = normalize(value).lower()
    if value in PLACEHOLDERS: raise ValueError('Pinyin contains a placeholder, not a pronunciation')
    totals = {0}
    for token in re.split(r"[\s'-]+", value):
        if not token: continue
        decomposed = unicodedata.normalize('NFD', token)
        clusters = re.findall(r'[^\u0300-\u036f][\u0300-\u036f]*', decomposed)
        if ''.join(clusters) != decomposed: raise ValueError(f'Invalid Pinyin marks: {token}')
        letters, tones = '', []
        for cluster in clusters:
            base, marks = cluster[0], cluster[1:]
            if '\u0308' in marks:
                if base != 'u': raise ValueError(f'Invalid Pinyin vowel: {token}')
                base = 'ü'
            count = sum(mark in '\u0304\u0301\u030c\u0300' for mark in marks)
            if count > 1: raise ValueError(f'Multiple tone marks on one Pinyin vowel: {token}')
            letters += base
            tones.append(count)
        reachable = {0: {0}}
        for end in range(1, len(letters)+1):
            for start in range(max(0, end-6), end):
                candidate = letters[start:end]
                known = candidate in SYLLABLES or (candidate.endswith('r') and candidate[:-1] in SYLLABLES)
                if not known or sum(tones[start:end]) > 1: continue
                if start > 0 and (candidate[0] in 'aeo' or candidate in {'m', 'n', 'ng', 'hm', 'hng', 'r'}): continue
                for count in reachable.get(start, ()):
                    reachable.setdefault(end, set()).add(count+1)
        counts = reachable.get(len(letters), set())
        if not counts: raise ValueError(f'Invalid Pinyin syllable sequence: {token}')
        totals = {a+b for a in totals for b in counts}
    return totals


def validate_vocabulary(text, words, require_complete=True):
    source = ''.join(HANZI.findall(text))
    covered = ''
    cursor = 0
    for number, word in enumerate(words, 1):
        if not word.translation.en.strip(): raise ValueError(f'Row {number}: English gloss is missing')
        if not word.hanzi:
            if word.pinyin: raise ValueError(f'Row {number}: grammar/non-Chinese rows must have empty Pinyin')
            continue
        if ''.join(HANZI.findall(word.hanzi)) != word.hanzi:
            raise ValueError(f'Row {number}: Hanzi must contain only Chinese characters, not labels such as phrase-level')
        if not word.pinyin: raise ValueError(f'Row {number} ({word.hanzi}): pronunciation is missing')
        try:
            counts = syllable_counts(word.pinyin)
            expected = {len(word.hanzi), len(word.hanzi)-word.hanzi[1:].count('儿')}
            if not counts.intersection(expected):
                raise ValueError(f'Pinyin syllable count does not match {word.hanzi}')
        except ValueError as exc:
            raise ValueError(f'Row {number} ({word.hanzi}): {exc}') from exc
        position = source.find(word.hanzi, cursor)
        if position < 0: raise ValueError(f'Row {number}: {word.hanzi} is not in the remaining source lyric in this order')
        cursor = position + len(word.hanzi)
        covered += word.hanzi
    if require_complete and covered != source:
        raise ValueError(f'Vocabulary must cover the complete Chinese lyric in order: expected {source}, received {covered or "(none)"}')


def usable_vocabulary(phrase):
    if not phrase.words or phrase.vocabulary == 'pending': return False
    try: validate_vocabulary(phrase.text, phrase.words)
    except ValueError: return False
    return True
