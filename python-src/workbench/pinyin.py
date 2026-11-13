import re
import unicodedata

MARKS = {letter: tuple(unicodedata.normalize('NFC', letter + accent) for accent in ('\u0304', '\u0301', '\u030c', '\u0300')) for letter in 'aeiouümn'}
MARKED = ''.join(''.join(tones) for tones in MARKS.values())
ALLOWED = set('abcdefghijklmnopqrstuvwxyzüABCDEFGHIJKLMNOPQRSTUVWXYZÜ ' + "'-" + MARKED + MARKED.upper())

def normalize(value: str) -> str:
    value = unicodedata.normalize('NFC', value).replace('u:', 'ü').replace('U:', 'Ü').replace('v', 'ü').replace('V', 'Ü').replace('’', "'")
    def syllable(match):
        letters, tone = match.group(1), int(match.group(2))
        # A numbered syllable may not also carry a tone mark.
        if any(c.lower() not in 'abcdefghijklmnopqrstuvwxyzü' for c in letters):
            raise ValueError('Mixed numbered and marked Pinyin')
        if tone in (0, 5): return letters
        low = letters.lower()
        index = next((low.index(c) for c in 'ae' if c in low), None)
        if index is None and 'ou' in low: index = low.index('o')
        if index is None: index = next((i for i in range(len(low)-1, -1, -1) if low[i] in 'iouümn'), None)
        if index is None: raise ValueError('Pinyin syllable has no tone-bearing letter')
        mark = MARKS[low[index]][tone-1]
        return letters[:index] + (mark.upper() if letters[index].isupper() else mark) + letters[index+1:]
    value = re.sub(r'([a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+)([0-5])', syllable, value)
    if any(c not in ALLOWED for c in value): raise ValueError('Invalid Pinyin; use diacritics or syllable tone numbers 0–5')
    return value.strip()
