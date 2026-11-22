"""Lyric elements shared by the Import and timing validators."""

import regex

LYRIC_LIMIT = 11
HAN = regex.compile(r"\p{Script=Han}+")
LATIN_WORD = r"(?:\p{Script=Latin}\p{M}*)+(?:['’](?:\p{Script=Latin}\p{M}*)+)*"
ELEMENT = regex.compile(r"\p{Script=Han}|" + LATIN_WORD + r"|\p{N}")
LATIN = regex.compile(LATIN_WORD)
LYRIC_RUN = regex.compile(HAN.pattern + "|" + LATIN_WORD)


def lyric_count(text):
    return len(ELEMENT.findall(text)) if HAN.search(text) else 0
