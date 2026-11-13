# Word segmentation editor and Pinyin contract (v2.1)

**Status:** Required for the **first functional React translation-editor milestone**, not an optional future enhancement. This document takes precedence if older references only mention add/remove/reorder. Reconcile these rules with the existing `src/Angela_Zhang_Keep_Walking.ts` schema and the local, uncommitted Python/Streamlit implementation.

## Scope: words within a phrase, not lyric timing

A **phrase** is a unique complete lyric line with shared EN/PL translations; repeated timeline **occurrences** have independent timestamps. A phrase's ordered `words` array contains word tokens (Hanzi + tone-marked Pinyin + English gloss), plus possible empty-Hanzi context/grammar-note tokens. **Merge** and **split** below operate only on the word tokens of one phrase. They never combine lyric phrases, alter timeline occurrence count, change timestamps, or rewrite the phrase-level EN/PL translations.

## Required UX

- In the **Word breakdown** editor, select a token row and offer **“Split word”** and **“Merge with next”** (or an equally discoverable selection-based equivalent). Keep **Add word**, **Grammar note**, **Move**, and **Remove**.
- **Merge** joins two **adjacent** lexical tokens in their current order. Disable or explicitly prevent merging an empty-Hanzi grammar note into a lexical word by default; do not discard such notes. If nonadjacent words need merging, the user reorders them first.
- Show an editable merge preview: combined Hanzi, combined Pinyin, and suggested combined gloss. Do **not** assume joining the original English glosses creates a correct dictionary meaning; require the gloss to be editable, and mark the result as needing review.
- **Split** lets the user choose the boundary **between Hanzi characters** in a lexical token, then edit separate Pinyin and English glosses for each side. Highlight the original combined Pinyin as a reference; **do not guess syllable boundaries from arbitrary Latin-string offsets** or fabricate glosses. Permit empty draft fields only while editing; review/export validation must flag incomplete word readings/glosses as appropriate to the project's established conventions.
- Preserve source character order and coverage: `left.hanzi + right.hanzi === original.hanzi` (at a Unicode-safe character boundary) and `merged.hanzi === first.hanzi + second.hanzi`. Preserve all other tokens, including their IDs and any empty-Hanzi notes.
- Split/merge are **undoable**, invalidate the edited phrase's reviewed status, update the selected token, word-count/coverage indicators, dictionary inspector and visual preview immediately. Export/reimport must persist the chosen segmentation. Retain stable identities for unchanged tokens; choose and document predictable IDs for replaced/merged rows (e.g., left token retains ID, new right token gets a new ID).
- If a new AI suggestion differs from a manually reviewed segmentation, present it as a proposal rather than silently reverting a user's split/merge. Suggestions and imported segmentation should be editable by the same controls.

## Pinyin: one lexical word = one contiguous orthographic unit

**Per-token `words[].pinyin` must not contain spaces between syllables of one word.** Use lowercase, tone-marked Hanyu Pinyin unless the current project's conventions explicitly require otherwise.

| Hanzi token | Correct `pinyin` field | Incorrect |
|---|---|---|
| 漂亮 | `piàoliang` | `piào liang` |
| 喜欢 | `xǐhuan` | `xǐ huan` |
| 应该 | `yīnggāi` | `yīng gāi` |
| 女儿 | `nǚ'ér` | `nǚ ér` |

- An apostrophe required by Pinyin spelling rules is **not** a space: `xī'ān` and `nǚ'ér` must keep the apostrophe. Don't simply strip punctuation or tone marks.
- **Different lexical tokens** are separated when rendering a full sentence's word-by-word Pinyin, e.g. `我` (`wǒ`) + `喜欢` (`xǐhuan`) → `wǒ xǐhuan`. The rule is about individual word fields, **not** removing all spaces from displayed lyric lines.
- Contextual annotations with empty Hanzi (such as `[if]`) may have empty Pinyin; do not force a fabricated reading for them. Do not infer lexical boundaries from Pinyin spaces alone.
- AI generation and revision prompts, the Python postprocessing pipeline, API response validation, editor validation, and exported files must all use this invariant. Prefer returning structured word tokens over a single unsegmented Pinyin string.
- **New AI drafts** with internal Pinyin whitespace must be normalized **only when the word boundary is already known and the change is safe**, otherwise flagged for correction. Do not silently rewrite preexisting **manually authored** Pinyin on import; display a warning and provide an explicit “Fix spacing” action. Never change the number of word tokens just to eliminate spaces.
- When **merging**, concatenating the two token Pinyin strings without a space is a useful *draft*, but verify required apostrophes and the correct lexical reading/tone sandhi conventions. When **splitting**, ask for both new readings explicitly unless a reliable aligned segmentation already exists. The user can revise everything before confirming.

## Pure domain operations (React UI should call these)

```ts
mergeAdjacentTokens(phrase, leftTokenId, { glossOverride?: string }): Phrase
splitToken(phrase, tokenId, {
  hanziBoundary: number, // Unicode character boundary
  leftPinyin: string,
  rightPinyin: string,
  leftGloss: string,
  rightGloss: string,
}): Phrase
validatePinyinWords(phrase): ValidationIssue[]
```

These are **suggested APIs**, not prescriptions for a new dependency or an OOP design. Make operations immutable, testable, and reversible. Never perform raw string substitutions in TypeScript source to edit word records.

## Required tests

1. Two tokens `漂` (`piào`) + `亮` (`liang`) merge into `漂亮` (`piàoliang`) and **one** `words` record; after editing the gloss, exporting `.ts` produces one record. Reimport matches semantically.
2. `漂亮` (`piàoliang`) splits at Hanzi boundary 1 into `漂` (`piào`) + `亮` (`liang`) using explicitly supplied readings and glosses; `.ts` round-trip preserves order and values.
3. Merging lexical words next to an empty-Hanzi note is blocked or requires explicit handling; no note disappears.
4. Split and merge do not change phrase text, phrase-level EN/PL translations, occurrence IDs, timing, or other words.
5. Undo/redo restores original tokens, selections where feasible, and reviewed status; changed segmentation marks phrase pending.
6. Backend draft `piào liang` for **one** `漂亮` token becomes `piàoliang` when safely normalized or raises a validation issue—never exported unnoticed. Existing user-authored input is not silently modified on import.
7. Multiword display `我喜欢` with tokens `我` and `喜欢` displays `wǒ xǐhuan`, not `wǒxǐhuan` and not `wǒ xǐ huan`.
8. Apostrophes, `ü`, tone marks and empty-Pinyin grammar notes survive normalization and export (`nǚ'ér`, `xī'ān`).
9. AI re-generation never silently re-segments a manually approved phrase.

The HTML design prototype illustrates the controls; the **production** React implementation must enforce all these invariants and tests.
