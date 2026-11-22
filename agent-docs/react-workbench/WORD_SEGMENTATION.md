# Word segmentation editor and Pinyin contract

**Status:** React editing, explicit spacing correction, split/merge, and reviewed Python translation drafts are implemented for owner review. Outstanding checks are in [TEST_PLAN.md](TEST_PLAN.md).

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

## Pinyin for lexical words and idioms

Use contiguous Pinyin for ordinary lexical words and retain spaced readings for idiom tokens. Use lowercase, tone-marked Hanyu Pinyin in dictionary forms. Preserve dictionary tones regardless of context; do not apply tone sandhi or other contextual tone changes.

| Hanzi token | Correct `pinyin` field | Spaced form  |
| ----------- | ---------------------- | ------------ |
| 漂亮        | `piàoliang`            | `piào liang` |
| 喜欢        | `xǐhuan`               | `xǐ huan`    |
| 应该        | `yīnggāi`              | `yīng gāi`   |
| 女儿        | `nǚ'ér`                | `nǚ ér`      |

- An apostrophe required by Pinyin spelling rules is **not** a space: `xī'ān` and `nǚ'ér` must keep the apostrophe. Don't simply strip punctuation or tone marks.
- **Different lexical tokens** are separated when rendering a full sentence's word-by-word Pinyin, e.g. `我` (`wǒ`) + `喜欢` (`xǐhuan`) → `wǒ xǐhuan`. The rule is about individual word fields, **not** removing all spaces from displayed lyric lines.
- Contextual annotations with empty Hanzi (such as `[if]`) may have empty Pinyin; do not force a fabricated reading for them. Do not infer lexical boundaries from Pinyin spaces alone.
- AI generation and revision prompts, the Python postprocessing pipeline, API response validation, editor validation, and exported files must all use this invariant. Prefer returning structured word tokens over a single unsegmented Pinyin string.
- **New AI drafts** use contiguous Pinyin for ordinary words such as `xǐhuan` and may use spaces for a single idiom token such as 一丝一毫 with `yī sī yī háo`. The validator checks syllables against the Hanzi and draft review flags ambiguous spaced alignment. Author-provided readings retain their spaces on import. “Fix spacing” is an explicit edit to the reading.
- When **merging**, concatenating the two token Pinyin strings without a space is a useful _draft_, but verify required apostrophes and the dictionary reading, preserving dictionary tones. When **splitting**, ask for both new readings explicitly unless a reliable aligned segmentation already exists. The user can revise everything before confirming.

## Implemented operations and remaining requirements

[domain.ts](../../web/src/domain.ts) owns immutable `mergeAdjacentTokens`, `splitToken`, `validatePinyinWords`, `fixSpacing` and undo/redo snapshots. Merge retains the left ID and removes the right ID; split retains the original ID on the left and allocates a fresh right ID. Unchanged tokens/notes keep their IDs. Both operations clear review and segmentation approval without changing phrase translations or occurrence timings. Split currently requires a token containing only Hanzi; punctuation-bearing lexical tokens must be edited explicitly rather than losing punctuation.

[split-suggestions.ts](../../web/src/split-suggestions.ts) aligns supplied Pinyin only when there is exactly one syllable alignment. It reuses a gloss only when matching project tokens have one unique nonempty meaning. Ambiguous readings/glosses stay blank; no compound meaning or pronunciation is invented. All suggestions remain editable before confirmation.

Frontend validation checks syllable validity/count, gloss completeness and Hanzi coverage. Explicit Fix spacing joins supplied readings and inserts apostrophes before vowel-initial syllables; it edits only the working project. Existing imported values remain untouched until that action. Legacy TS retains segmentation values; project JSON additionally retains token IDs and approval state.

The Python generation prompt requests contiguous readings for ordinary words and spaced readings for idioms. Python and React check Pinyin syllable counts and source coverage. The editor keeps proposed segmentation separate until the owner applies it.

## Executable verification and remaining coverage

- [Domain tests](../../web/tests/domain.test.ts) cover merge/split identities and semantic TS round trips, Unicode boundaries, note preservation, unchanged translations/timing, review invalidation, undo/redo, Pinyin validation/spacing/apostrophes and conservative split suggestions.
- [Browser acceptance](../../web/tests/browser.ts) exercises the editor dialogs, explicit corrections, review and project recovery through the UI.
- The translation fixture exercises a single idiom token with a literal gloss and spaced reading through the Python draft pipeline, Workbench JSON, the preview reading alignment, and legacy TypeScript. The opt-in [evaluation sample](../../web/README.md#automatic-translation) supports a separate check of live dictionary-tone accuracy.

## Word choices during import

Jieba drafts the final phrases. Open **Dictionary** in the Import sidebar to inspect CC-CEDICT words starting at a character, their readings and meanings. Choosing a word replaces its overlapping token range in the shared lyric. The browser workflow selects 明了 · míngliǎo in 我比谁都明了 and retains 说明 · shuōmíng followed by 了 · le in 他说明了原因. Both choices survive JSON reopen. **Explain with AI** uses the selected provider and the displayed alternatives. Provider advice is optional and requires a separate user action.
