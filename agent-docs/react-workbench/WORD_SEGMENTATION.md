# Word segmentation editor and Pinyin contract

**Status (source-inspected 2026-11-14):** React editing, validation, explicit spacing correction and split/merge are implemented. Python AI normalization/validation and protected AI suggestion acceptance remain C requirements. Outstanding checks are in [TEST_PLAN.md](TEST_PLAN.md).

## Scope: words within a phrase, not lyric timing

A **phrase** is a unique complete lyric line with shared EN/PL translations; repeated timeline **occurrences** have independent timestamps. A phrase's ordered `words` array contains word tokens (Hanzi + tone-marked Pinyin + English gloss), plus possible empty-Hanzi context/grammar-note tokens. **Merge** and **split** below operate only on the word tokens of one phrase. They never combine lyric phrases, alter timeline occurrence count, change timestamps, or rewrite the phrase-level EN/PL translations.

## Required UX

- In the **Word breakdown** editor, select a token row and offer **“Split word”** and **“Merge with next”** (or an equally discoverable selection-based equivalent). Keep **Add word**, **Move**, and **Remove**, and preserve support for empty-Hanzi grammar notes. The accepted current editor has one empty-row Add word action; a separate Grammar note action is not required.
- **Merge** joins two **adjacent** lexical tokens in their current order. Disable or explicitly prevent merging an empty-Hanzi grammar note into a lexical word by default; do not discard such notes. If nonadjacent words need merging, the user reorders them first.
- Show an editable merge preview: combined Hanzi, combined Pinyin, and suggested combined gloss. Do **not** assume joining the original English glosses creates a correct dictionary meaning; require the gloss to be editable, and mark the result as needing review.
- **Split** lets the user choose the boundary **between Hanzi characters** in a lexical token, then edit separate Pinyin and English glosses for each side. Highlight the original combined Pinyin as a reference; **do not guess syllable boundaries from arbitrary Latin-string offsets** or fabricate glosses. Permit empty draft fields only while editing; review/export validation must flag incomplete word readings/glosses as appropriate to the project's established conventions.
- Preserve source character order and coverage: `left.hanzi + right.hanzi === original.hanzi` (at a Unicode-safe character boundary) and `merged.hanzi === first.hanzi + second.hanzi`. Preserve all other tokens, including their IDs and any empty-Hanzi notes.
- Split/merge are **undoable**, invalidate the edited phrase's reviewed status, update the selected token, coverage/review validation and dictionary inspector immediately. Export/reimport must persist the chosen segmentation. Retain stable identities for unchanged tokens; choose and document predictable IDs for replaced/merged rows (e.g., left token retains ID, new right token gets a new ID).
- If a new AI suggestion differs from a manually reviewed segmentation, present it as a proposal rather than silently reverting a user's split/merge. Suggestions and imported segmentation should be editable by the same controls.

## Pinyin: one lexical word = one contiguous orthographic unit

**Per-token `words[].pinyin` must not contain spaces between syllables of one word.** Use lowercase, tone-marked Hanyu Pinyin in dictionary forms. Preserve dictionary tones regardless of context; do not apply tone sandhi or other contextual tone changes.

| Hanzi token | Correct `pinyin` field | Incorrect    |
| ----------- | ---------------------- | ------------ |
| 漂亮        | `piàoliang`            | `piào liang` |
| 喜欢        | `xǐhuan`               | `xǐ huan`    |
| 应该        | `yīnggāi`              | `yīng gāi`   |
| 女儿        | `nǚ'ér`                | `nǚ ér`      |

- An apostrophe required by Pinyin spelling rules is **not** a space: `xī'ān` and `nǚ'ér` must keep the apostrophe. Don't simply strip punctuation or tone marks.
- **Different lexical tokens** are separated when rendering a full sentence's word-by-word Pinyin, e.g. `我` (`wǒ`) + `喜欢` (`xǐhuan`) → `wǒ xǐhuan`. The rule is about individual word fields, **not** removing all spaces from displayed lyric lines.
- Contextual annotations with empty Hanzi (such as `[if]`) may have empty Pinyin; do not force a fabricated reading for them. Do not infer lexical boundaries from Pinyin spaces alone.
- AI generation and revision prompts, the Python postprocessing pipeline, API response validation, editor validation, and exported files must all use this invariant. Prefer returning structured word tokens over a single unsegmented Pinyin string.
- **New AI drafts** with internal Pinyin whitespace must be normalized **only when the word boundary is already known and the change is safe**, otherwise flagged for correction. Do not silently rewrite preexisting **manually authored** Pinyin on import; display a warning and provide an explicit “Fix spacing” action. Never change the number of word tokens just to eliminate spaces.
- When **merging**, concatenating the two token Pinyin strings without a space is a useful _draft_, but verify required apostrophes and the dictionary reading, preserving dictionary tones. When **splitting**, ask for both new readings explicitly unless a reliable aligned segmentation already exists. The user can revise everything before confirming.

## Implemented operations and remaining requirements

[domain.ts](../../web/src/domain.ts) owns immutable `mergeAdjacentTokens`, `splitToken`, `validatePinyinWords`, `fixSpacing` and undo/redo snapshots. Merge retains the left ID and removes the right ID; split retains the original ID on the left and allocates a fresh right ID. Unchanged tokens/notes keep their IDs. Both operations clear review and segmentation approval without changing phrase translations or occurrence timings. Split currently requires a token containing only Hanzi; punctuation-bearing lexical tokens must be edited explicitly rather than losing punctuation.

[split-suggestions.ts](../../web/src/split-suggestions.ts) aligns supplied Pinyin only when there is exactly one syllable alignment. It reuses a gloss only when matching project tokens have one unique nonempty meaning. Ambiguous readings/glosses stay blank; no compound meaning or pronunciation is invented. All suggestions remain editable before confirmation.

Frontend validation checks internal whitespace, syllable validity/count, gloss completeness and Hanzi coverage. Explicit Fix spacing joins supplied readings and inserts apostrophes before vowel-initial syllables; it edits only the working project. Existing imported values remain untouched until that action. Legacy TS retains segmentation values; project JSON additionally retains token IDs and approval state.

Python's existing word normalization still permits internal spaces (`piào liang` for one 漂亮 token). Frontend validation does not complete that backend requirement. C must enforce the new-output contract in prompts/postprocessing/response validation, keep AI proposals separate, and never silently replace manually approved segmentation. Review/export warnings must remain visible; draft downloads are not proof that all linguistic validation passes.

## Executable verification and remaining coverage

- [Domain tests](../../web/tests/domain.test.ts) cover merge/split identities and semantic TS round trips, Unicode boundaries, note preservation, unchanged translations/timing, review invalidation, undo/redo, Pinyin validation/spacing/apostrophes and conservative split suggestions.
- [Browser acceptance](../../web/tests/browser.ts) exercises the editor dialogs, explicit corrections, review and project recovery through the UI.
- Python new-output spacing validation and protected AI regeneration remain unimplemented C work; their regression tests must accompany implementation. Dictionary-tone preservation must also be covered when that generation/normalization path is implemented. See [the existing Python Pinyin carry-forward](../ROADMAP.md#unresolved-carry-forwards-not-cleared-by-accepting-checkpoint-b) and [C acceptance gates](TEST_PLAN.md#m3--python-ai).
