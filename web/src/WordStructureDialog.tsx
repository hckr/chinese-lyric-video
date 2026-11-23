import { useEffect, useState } from "react";
import { dictionaryReadings, readingKey } from "./dictionary-readings.ts";
import { lookupDictionary } from "./dictionary-service.ts";
import {
  Phrase,
  Project,
  Word,
  joinReadings,
  mergeAdjacentTokens,
  splitToken,
} from "./domain";
import { splitSuggestions } from "./split-suggestions";

export function WordStructureDialog({
  selected,
  next,
  dialogReturnFocus,
  project,
  act,
  phrase,
  editPhrase,
  dialog,
  setDialog,
}: {
  selected: Word;
  next: Word | undefined;
  dialogReturnFocus: React.RefObject<HTMLElement | null>;
  project: Project;
  act: (fn: () => void) => void;
  phrase: Phrase;
  editPhrase: (p: Phrase, id?: string) => void;
  dialog: "split" | "merge";
  setDialog: (kind: null) => void;
}) {
  const initialSplit =
    dialog === "split"
      ? splitSuggestions(selected, 1, project.phrases)
      : undefined;
  const [boundary, setBoundary] = useState(1),
    [leftPy, setLeftPy] = useState(
      initialSplit?.leftPinyin ??
        joinReadings([selected.pinyin, next?.pinyin ?? ""]),
    ),
    [rightPy, setRightPy] = useState(initialSplit?.rightPinyin ?? ""),
    [leftGloss, setLeftGloss] = useState(
      initialSplit?.leftGloss ??
        [selected.translation.en, next?.translation.en].join("; "),
    ),
    [rightGloss, setRightGloss] = useState(initialSplit?.rightGloss ?? "");
  useEffect(() => {
    if (dialog !== "merge" || !selected?.hanzi || !next?.hanzi) return;
    const term = selected.hanzi + next.hanzi;
    const initial = joinReadings([selected.pinyin, next.pinyin]);
    let active = true;
    void lookupDictionary(term).then(
      (entries) => {
        if (!active) return;
        const options = dictionaryReadings(
          entries.filter((entry) => entry.hanzi === term),
        );
        const matching = options.filter(
          (option) =>
            readingKey(term, option.pinyin) === readingKey(term, initial),
        );
        const suggested =
          matching.length === 1
            ? matching[0]
            : initial
              ? undefined
              : options.length === 1
                ? options[0]
                : undefined;
        if (suggested)
          setLeftPy((value) => (value === initial ? suggested.pinyin : value));
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [dialog, selected, next]);
  useEffect(() => {
    if (!dialog) return;
    const previous = dialogReturnFocus.current;
    const onKey = (e: KeyboardEvent) => {
      const panel = document.querySelector('[role="dialog"]');
      if (e.key === "Escape") {
        e.preventDefault();
        setDialog(null);
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const fields = [
        ...panel.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, textarea, select, a[href]",
        ),
      ];
      const first = fields[0],
        last = fields[fields.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [dialog]);
  function populateSplit(at: number) {
    if (!selected || !project) return;
    const suggestion = splitSuggestions(selected, at, project.phrases);
    setBoundary(at);
    setLeftPy(suggestion.leftPinyin);
    setRightPy(suggestion.rightPinyin);
    setLeftGloss(suggestion.leftGloss);
    setRightGloss(suggestion.rightGloss);
  }
  return (
    <div className="backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="dialog"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(() => {
              const updated =
                dialog === "merge"
                  ? mergeAdjacentTokens(phrase, selected.id, {
                      pinyin: leftPy,
                      glossOverride: leftGloss,
                    })
                  : splitToken(phrase, selected.id, {
                      hanziBoundary: boundary,
                      leftPinyin: leftPy,
                      rightPinyin: rightPy,
                      leftGloss,
                      rightGloss,
                    });
              editPhrase(updated, selected.id);
              setDialog(null);
            });
          }}
        >
          <h2 id="dialog-title">
            {dialog === "merge" ? "Merge adjacent words" : "Split word"}
          </h2>
          <p>
            Original reading: {selected.pinyin}
            {dialog === "merge" ? ` + ${next?.pinyin}` : ""}. Confirm the
            suggested readings and meanings before confirming.
          </p>
          {dialog === "merge" ? (
            <h3>
              {selected.hanzi}
              {next?.hanzi}
            </h3>
          ) : (
            <label>
              Split between characters
              <select
                value={boundary}
                onChange={(e) => populateSplit(Number(e.target.value))}
              >
                {[...selected.hanzi].slice(1).map((_, i) => (
                  <option key={i} value={i + 1}>
                    {[...selected.hanzi].slice(0, i + 1).join("")} |{" "}
                    {[...selected.hanzi].slice(i + 1).join("")}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {dialog === "merge"
              ? "Combined Pinyin"
              : `${[...selected.hanzi].slice(0, boundary).join("")} — Pinyin`}
            <input
              autoFocus
              value={leftPy}
              onChange={(e) => setLeftPy(e.target.value)}
            />
          </label>
          <label>
            {dialog === "merge"
              ? "Combined English gloss (edit the meaning)"
              : "Left English gloss"}
            <textarea
              value={leftGloss}
              onChange={(e) => setLeftGloss(e.target.value)}
            />
          </label>
          {dialog === "split" && (
            <>
              <label>
                {[...selected.hanzi].slice(boundary).join("")} — Pinyin
                <input
                  value={rightPy}
                  onChange={(e) => setRightPy(e.target.value)}
                />
              </label>
              <label>
                Right English gloss
                <textarea
                  value={rightGloss}
                  onChange={(e) => setRightGloss(e.target.value)}
                />
              </label>
            </>
          )}
          <p>
            Readings are prefilled when the original Pinyin has an unambiguous
            syllable alignment. Meanings are reused from matching words
            elsewhere in this project; otherwise, enter them yourself. A
            compound’s meaning cannot reliably be divided between its
            characters.
          </p>
          <p>This change needs review. Undo restores the original word.</p>
          <div className="actions">
            <button type="button" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button type="submit" className="primary">
              Confirm {dialog} draft
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
