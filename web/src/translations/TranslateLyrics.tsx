import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { z } from "zod";
import {
  phrasesInAppearanceOrder,
  type Phrase,
  type Project,
} from "../domain.ts";
import {
  alignmentWarnings,
  canApplyDraft,
  applyDrafts,
  content,
  draftIssues,
  draftProblems,
  fingerprint,
  matchesBase,
  resultingVocabulary,
  stageLabels,
  translationState,
} from "./translation.ts";
import {
  type Draft,
  type DraftValue,
  type DraftWord,
  type Stage,
  type TranslationState,
  stageSchema,
  stages,
  translationSettingsSchema,
  effortSchema,
  valueSchema,
  vocabularySchema,
} from "./translation-schema.ts";

const responseDraft = z.object({
  kind: z.literal("draft"),
  id: z.string(),
  stage: stageSchema,
  value: valueSchema,
  support: vocabularySchema.nullable(),
  dictionary: z.array(z.string()),
  promptVersion: z.string().min(1),
});

type Revision = { instruction: string; wordIndex?: number; draft?: Draft };

const issueText = {
  sentence_annotations:
    "The model kept adding pronunciation or word explanations. Revise the sentence or try another model.",
  oversized:
    "This lyric and its context exceed the model’s request limit. Choose a model with more capacity or shorten song notes.",
  access:
    "The provider denied access. Check the API key and project permissions.",
  model:
    "The provider could not find the configured model. Check Model settings.",
  request:
    "The provider rejected the request. Check model support for structured JSON output.",
  configuration: "Provider setup failed. Check the API key and Model settings.",
  zero_quota:
    "This model has zero allowance for the requested operation. Choose another model.",
  daily_quota:
    "This model’s daily quota is exhausted. Choose another model or retry after the daily reset.",
  tokens_per_minute:
    "This model reached its tokens-per-minute limit. Wait a minute or choose another model.",
  requests_per_minute:
    "This model reached its requests-per-minute limit. Wait a minute or choose another model.",
  rate_limit:
    "The provider reached a usage limit. Check the model’s usage in the provider dashboard.",
  timeout: "The request to the provider timed out.",
  unavailable: "The provider was temporarily unavailable.",
  connection:
    "The provider request failed. Check the connection and try again.",
  output_limit:
    "The model reached its output limit before returning a complete draft.",
  blocked_response: "The provider blocked the response.",
  empty_response: "The model returned an empty response after retries.",
  invalid_response: "The model could not produce a valid draft after retries.",
  response_format:
    "The model returned a response in an unexpected format after retries.",
  word_boundaries:
    "The model changed the existing word boundaries after retries.",
  waiting_for_vocabulary:
    "Waiting for vocabulary before these sentences can be drafted.",
  stopped: "The run stopped before requesting these drafts.",
} as const;

const responseIssue = z.object({
  diagnostic: z.string().max(500).optional(),
  stage: stageSchema.optional(),
  ids: z.array(z.string()).default([]),
  reason: z.enum(
    Object.keys(issueText) as [
      keyof typeof issueText,
      ...(keyof typeof issueText)[],
    ],
  ),
});

export type TranslationExchange = {
  id: string;
  label: string;
  prompt: string;
  response?: string;
};

type RunDetail = { message: string; stage?: Stage; lyrics?: string[] };
type DraftField = {
  previous: string;
  value: string;
  readOnly: boolean;
  edit: (value: string) => void;
};
export type DraftPreview = {
  wordProvider?: import("./WordReview").WordProvider;
  actions: Partial<Record<Stage, ReactNode>>;
  wordAction?: (index: number) => ReactNode;
  vocabulary?: {
    words: DraftWord[];
    previousBoundaries?: string;
    pinyin: (index: number) => DraftField | undefined;
    gloss: (index: number) => DraftField | undefined;
  };
  sentences: Partial<Record<"en" | "pl", DraftField>>;
};

export function TranslateLyrics({
  hidden,
  report,
  project,
  phrase,
  exchanges,
  setExchanges,
  update,
  apply,
  selectPhrase,
  secondaryAction,
  children,
}: {
  report?: (s: string) => void;
  hidden: boolean;
  project: Project;
  phrase: Phrase | undefined;
  exchanges: TranslationExchange[];
  setExchanges: Dispatch<SetStateAction<TranslationExchange[]>>;
  update: (
    edit: (work: TranslationState) => TranslationState,
    phraseId?: string,
  ) => void;
  apply: (edit: (project: Project) => Project) => void;
  selectPhrase: (phrase: Phrase) => void;
  secondaryAction: ReactNode;
  children: (preview: DraftPreview, reviewActions: ReactNode) => ReactNode;
}) {
  const work = translationState(project);
  const [settings, setSettings] = useState(work.settings);
  type Provider = "Gemini" | "Groq";
  const [catalog, setCatalog] = useState<Partial<Record<Provider, string[]>>>(
    {},
  );
  const [availability, setAvailability] = useState<string | null>(null);
  const provider = settings.provider ?? "Gemini";
  const [counts, setCounts] = useState({ ready: 0, total: 0 });
  const [eta, setEta] = useState<number>();
  const [retryAt, setRetryAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!retryAt) return;
    const tick = () =>
      setSeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  const hasSavedSettings = useRef(Boolean(project.translationWork));
  hasSavedSettings.current = Boolean(project.translationWork);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/translation/providers", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const data = await r.json();
        if (controller.signal.aborted) return;
        setCatalog(data);
        setAvailability(
          Object.keys(data).length
            ? ""
            : "Configure GROQ_API_KEY or GEMINI_API_KEY to translate.",
        );
        if (!hasSavedSettings.current && data.Groq?.length)
          setSettings((s) => ({ ...s, provider: "Groq", model: data.Groq[0] }));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setAvailability("Could not check local translation providers.");
      });
    return () => controller.abort();
  }, []);
  const [scope, setScope] = useState<"song" | "lyric">("lyric");
  const [chosen, setChosen] = useState<Stage[]>([...stages]);
  const [revisionTarget, setRevisionTarget] = useState<{
    phraseId: string;
    chooseParts?: boolean;
    stages: Stage[];
    wordIndex?: number;
    draft?: Draft;
  }>();
  const [revisionResult, setRevisionResult] = useState<{
    phraseId: string;
    message: string;
  }>();
  const [instruction, setInstruction] = useState("");
  const [running, setRunning] = useState(false);
  const [pendingLyrics, setPendingLyrics] = useState<Set<string>>(new Set());
  const draftLocked = running && !!phrase && pendingLyrics.has(phrase.id);
  const [needsAttention, setNeedsAttention] = useState(false);
  const [progress, setProgress] = useState("");
  useEffect(() => {
    report?.(
      running
        ? counts.total
          ? counts.ready + "/" + counts.total
          : "Working…"
        : needsAttention
          ? "!"
          : "",
    );
    return () => report?.("");
  }, [running, counts, needsAttention, report]);
  const [details, setDetails] = useState<RunDetail[]>([]);
  const detailsList = useRef<HTMLUListElement>(null);
  const followDetails = useRef(true);
  function scrollToLatestDetail() {
    const list = detailsList.current;
    if (list && followDetails.current) list.scrollTop = list.scrollHeight;
  }
  useEffect(scrollToLatestDetail, [details]);
  const [songIncomplete, setSongIncomplete] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const ordered = phrasesInAppearanceOrder(project);
  const targets = scope === "song" ? ordered : phrase ? [phrase] : [];
  const vocabularyFor = (target: Phrase) =>
    work.drafts.find(
      (draft) =>
        draft.phraseId === target.id &&
        draft.stage === "vocabulary" &&
        matchesBase(target, draft) &&
        !draftProblems(target, draft).length,
    );
  const supportMatches = (target: Phrase, draft: Draft) =>
    draft.stage === "vocabulary" ||
    draft.support === fingerprint(content(target, "vocabulary")) ||
    (vocabularyFor(target) &&
      draft.support ===
        fingerprint(resultingVocabulary(target, vocabularyFor(target))));
  const fresh = (target: Phrase, draft: Draft) =>
    matchesBase(target, draft) && supportMatches(target, draft);
  const vocabularyMissing = (target: Phrase) =>
    !target.words.length ||
    target.words.some(
      (word) =>
        (word.hanzi && !word.pinyin.trim()) || !word.translation.en.trim(),
    );
  const plan = (
    mode: Draft["mode"],
    lyrics = targets,
    components = chosen,
    glosses = false,
  ) =>
    lyrics.flatMap((target) =>
      stages
        .filter((stage) => {
          if (
            !components.includes(stage) &&
            !(
              mode === "fill" &&
              stage === "vocabulary" &&
              components.some(
                (item) =>
                  item !== "vocabulary" && !target.translation[item].trim(),
              )
            )
          )
            return false;
          if (glosses) return stage === "vocabulary" && target.words.length > 0;
          if (
            mode === "fill" &&
            (stage === "vocabulary"
              ? !vocabularyMissing(target)
              : !!target.translation[stage].trim())
          )
            return false;
          if (mode === "replace") return true;
          return !work.drafts.some(
            (draft) =>
              draft.phraseId === target.id &&
              draft.stage === stage &&
              draft.wordIndex === undefined &&
              fresh(target, draft) &&
              !draftProblems(target, draft).length,
          );
        })
        .map((stage) => ({ target, stage })),
    );
  const fill = plan("fill");
  const replace = plan("replace");
  const song = plan("fill", ordered, [...stages]);
  const songCount = new Set(song.map(({ target }) => target.id)).size;
  const count = (jobs: typeof fill) => {
    const lyrics = new Set(jobs.map(({ target }) => target.id)).size;
    return `${jobs.length} ${jobs.length === 1 ? "component" : "components"} across ${lyrics} ${lyrics === 1 ? "lyric" : "lyrics"}`;
  };

  async function run(
    jobs: typeof fill,
    mode: Draft["mode"],
    revision?: Revision,
    glosses = false,
    wholeSong = false,
  ) {
    if (!catalog[provider] || request.current || !jobs.length) return;
    const checked = translationSettingsSchema.safeParse(settings);
    if (!checked.success) {
      setProgress("Check Translation options before retrying.");
      setDetails([
        {
          message:
            "Enter a model name and keep song notes within 12,000 characters.",
        },
      ]);
      return;
    }
    const showRevision = (message: string) => {
      if (revision) setRevisionResult({ phraseId: jobs[0].target.id, message });
    };
    if (!revision) setRevisionResult(undefined);
    showRevision(
      "Revising " +
        jobs.map((job) => stageLabels[job.stage]).join(" and ") +
        "…",
    );
    const configuration = checked.data;
    const controller = new AbortController();
    request.current = controller;
    setCounts({ ready: 0, total: jobs.length });
    setRunning(true);
    setNeedsAttention(false);
    followDetails.current = true;
    setDetails([]);
    if (wholeSong) setSongIncomplete(false);
    setProgress("Starting local translation worker…");
    update((state) => ({ ...state, settings: configuration }));
    const pending = new Set(
      jobs.map(({ target, stage }) => JSON.stringify([target.id, stage])),
    );
    const lyricIds = new Set(jobs.map(({ target }) => target.id));
    setPendingLyrics(lyricIds);
    const byId = new Map(ordered.map((target) => [target.id, target]));
    const sent = [...lyricIds].map((id) => {
      const target = byId.get(id)!;
      const replacingVocabulary = pending.has(
        JSON.stringify([id, "vocabulary"]),
      );
      const proposed = vocabularyFor(target);
      const priorVocabulary =
        !replacingVocabulary &&
        proposed &&
        ((mode === "fill" && vocabularyMissing(target)) ||
          (mode === "replace" &&
            proposed.mode === "replace" &&
            revision?.wordIndex === undefined));
      const translation = { ...target.translation };
      if (revision) {
        for (const draft of work.drafts) {
          if (
            draft.phraseId === id &&
            draft.stage !== "vocabulary" &&
            typeof draft.value === "string" &&
            fresh(target, draft)
          ) {
            translation[draft.stage] = draft.value;
          }
        }
      }
      return {
        id,
        text: target.lyricKey,
        words:
          revision && proposed
            ? resultingVocabulary(target, proposed)
            : priorVocabulary
              ? resultingVocabulary(target, proposed)
              : content(target, "vocabulary"),
        translation,
      };
    });
    let operation = "Checking model access";
    let done = false;
    let exchangeId: string | undefined;
    let terminalDiagnostic = "";
    let sample:
      | { stage: Stage; started: number; remaining: number; count: number }
      | undefined;
    const rates = new Map<Stage, number[]>();
    setEta(undefined);
    const report = (detail: RunDetail) =>
      setDetails((previous) => [...previous, detail]);
    function receive(line: string) {
      if (!line.trim() || controller.signal.aborted) return;
      const event = JSON.parse(line);
      setRetryAt(0);
      if (
        event.kind === "usage" &&
        [event.input, event.output, event.cached].some(
          (value) => typeof value === "number",
        )
      )
        report({
          message: Object.entries(event)
            .filter(([key, val]) => key !== "kind" && typeof val === "number")
            .map(([key, val]) => key + " tokens " + val)
            .join(" · "),
        });
      if (event.kind === "activity") setProgress("Receiving translation…");
      if (event.kind === "processing" || event.kind === "validating")
        setProgress(
          event.kind === "processing"
            ? "Processing response…"
            : "Validating translation…",
        );
      if (event.kind === "error") throw Error(event.message);
      if (event.kind === "done") {
        setProgress("Completing translation…");
        done = true;
        return;
      }
      if (event.kind === "issue") {
        const issue = responseIssue.parse(event);
        if (issue.diagnostic || revision)
          terminalDiagnostic = issue.diagnostic ?? issueText[issue.reason];
        report({
          message: issue.diagnostic ?? issueText[issue.reason],
          stage: issue.stage,
          lyrics: issue.ids.map((id) => byId.get(id)?.lyricKey ?? id),
        });
        return;
      }
      if (event.kind === "notice") {
        report({ message: event.message });
        return;
      }
      if (event.kind === "provider") setProgress("Checking model access…");
      if (event.kind === "response" && exchangeId) {
        const id = exchangeId;
        const response = typeof event.text === "string" ? event.text : "";
        setExchanges((previous) =>
          previous.map((exchange) =>
            exchange.id === id ? { ...exchange, response } : exchange,
          ),
        );
        return;
      }
      if (event.kind === "request") {
        sample = event.corrective
          ? undefined
          : {
              stage: event.stage,
              started: performance.now(),
              remaining: event.count,
              count: event.count,
            };
        operation = `${stageLabels[event.stage as Stage]} · ${event.count} ${event.count === 1 ? "lyric" : "lyrics"}${event.corrective ? " · correcting response" : ""}`;
        setEta(undefined);
        setProgress(operation);
        if (typeof event.prompt === "string") {
          const id = crypto.randomUUID();
          exchangeId = id;
          const entry = {
            id,
            label: `${provider} · ${configuration.model} · ${operation}`,
            prompt: event.prompt,
          };
          setExchanges((previous) => [...previous, entry]);
        }
      }
      if (event.kind === "attempt") setProgress(operation);
      if (event.kind === "retry") {
        sample = undefined;
        setEta(undefined);
        const reason =
          event.reason === "tokens_per_minute"
            ? "Waiting for token capacity"
            : event.reason === "requests_per_minute"
              ? "Waiting for the request limit to reset"
              : event.code === 429
                ? `${provider} is temporarily limiting requests`
                : "Temporary provider error";
        setProgress(`${operation} · ${reason}`);
        setRetryAt(Date.now() + event.delay * 1000);
      }
      if (event.kind !== "draft") return;
      const parsed = responseDraft.parse(event);
      const target = byId.get(parsed.id);
      const key = JSON.stringify([parsed.id, parsed.stage]);
      if (!target || !pending.has(key)) return;
      const draft: Draft = {
        id: crypto.randomUUID(),
        phraseId: target.id,
        source: target.lyricKey,
        stage: parsed.stage,
        wordIndex: revision?.wordIndex,
        base: fingerprint(content(target, parsed.stage)),
        value: parsed.value,
        support: parsed.support ? fingerprint(parsed.support) : null,
        mode,
        glossesOnly:
          (glosses || revision?.draft?.glossesOnly) &&
          parsed.stage === "vocabulary"
            ? true
            : undefined,
        dictionary: parsed.dictionary,
        provenance: {
          ...configuration,
          provider,
          promptVersion: parsed.promptVersion,
          instruction: revision?.instruction,
        },
      };
      const prior = revision?.draft;
      const index = revision?.wordIndex;
      if (
        prior?.stage === "vocabulary" &&
        index !== undefined &&
        parsed.stage === "vocabulary" &&
        Array.isArray(draft.value)
      ) {
        const rows = resultingVocabulary(target, prior);
        const [word] = draft.value;
        if (
          draft.value.length !== 1 ||
          !word ||
          word.hanzi !== rows[index]?.hanzi
        ) {
          report({
            message: "The revision did not match the selected word.",
            stage: parsed.stage,
            lyrics: [target.lyricKey],
          });
          return;
        }
        draft.wordIndex = undefined;
        draft.value = rows.map((row, i) => (i === index ? word : row));
      }
      const issues = draftProblems(target, draft);
      if (
        parsed.stage !== "vocabulary" &&
        (!parsed.support ||
          draftIssues(target, "vocabulary", parsed.support).length)
      )
        issues.push("Sentence draft has invalid supporting vocabulary.");
      if (issues.length) {
        report({
          message: issues.join(" "),
          stage: parsed.stage,
          lyrics: [target.lyricKey],
        });
        return;
      }
      pending.delete(key);
      if (
        !stages.some((stage) => pending.has(JSON.stringify([target.id, stage])))
      ) {
        setPendingLyrics((previous) => {
          const remaining = new Set(previous);
          remaining.delete(target.id);
          return remaining;
        });
      }
      if (sample && sample.stage === parsed.stage && --sample.remaining === 0) {
        const times = rates.get(sample.stage) ?? [];
        times.push((performance.now() - sample.started) / 1000 / sample.count);
        rates.set(sample.stage, times);
        sample = undefined;
      }
      let estimate = 0;
      for (const job of pending) {
        const times = rates.get(JSON.parse(job)[1]);
        if (!times || times.length < 3) {
          estimate = 0;
          break;
        }
        estimate += times.reduce((a, b) => a + b, 0) / times.length;
      }
      setEta(estimate > 0 ? Math.ceil(estimate) : undefined);
      setCounts({ ready: jobs.length - pending.size, total: jobs.length });
      update(
        (state) => ({
          ...state,
          drafts: [
            ...state.drafts.filter(
              (old) =>
                old.phraseId !== draft.phraseId || old.stage !== draft.stage,
            ),
            draft,
          ],
        }),
        draft.phraseId,
      );
    }
    try {
      const response = await fetch(
        `/api/translation/${revision ? "revise" : "generate"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            ...configuration,
            vocabularyMode:
              glosses || revision?.draft?.glossesOnly ? "glosses" : mode,
            phrases: sent,
            timeline: project.occurrences.flatMap((cue) => {
              const target = byId.get(cue.phraseId);
              return target
                ? [
                    {
                      id: cue.id,
                      lyricKey: target.lyricKey,
                      startMs: 0,
                      endMs: 0,
                    },
                  ]
                : [];
            }),
            jobs: Object.fromEntries(
              stages
                .map((stage) => [
                  stage,
                  jobs
                    .filter((job) => job.stage === stage)
                    .map(({ target }) => target.id),
                ])
                .filter(([, ids]) => ids.length),
            ),
            revision: revision && {
              instruction: revision.instruction,
              wordIndex: revision.wordIndex,
              proposedWords:
                revision.draft?.stage === "vocabulary" && phrase
                  ? resultingVocabulary(phrase, revision.draft)
                  : undefined,
            },
          }),
        },
      );
      if (!response.body)
        throw Error("Translation service returned no response.");
      let buffer = "";
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      for (
        let chunk = await reader.read();
        !chunk.done;
        chunk = await reader.read()
      ) {
        buffer += chunk.value;
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines) receive(line);
      }
      reader.releaseLock();
      receive(buffer);
      if (!done || !response.ok)
        throw Error("Translation ended early. Retry unfinished drafts.");
      const summary = stages.flatMap((stage) => {
        const requested = jobs.filter((job) => job.stage === stage);
        if (!requested.length) return [];
        const unfinished = requested.filter(({ target }) =>
          pending.has(JSON.stringify([target.id, stage])),
        ).length;
        const label =
          stage === "vocabulary" ? "Vocabulary" : stageLabels[stage];
        return [
          `${label} ready for ${requested.length - unfinished} of ${requested.length} ${requested.length === 1 ? "lyric" : "lyrics"}`,
        ];
      });
      if (pending.size && !controller.signal.aborted) setNeedsAttention(true);
      if (revision) {
        const ready = jobs.filter(
          ({ target, stage }) =>
            !pending.has(JSON.stringify([target.id, stage])),
        );
        const result = ready.length
          ? "Revised drafts ready for review: " +
            ready.map((job) => stageLabels[job.stage]).join(", ") +
            "."
          : "No revised draft was generated.";
        showRevision(
          result +
            (pending.size
              ? " " +
                (terminalDiagnostic ||
                  "See Run details for the unfinished parts.")
              : ""),
        );
      }
      setProgress(
        terminalDiagnostic ||
          `${pending.size ? "" : "100% · "}${summary.join(" · ")}${pending.size ? ` · ${pending.size} unfinished` : ""}`,
      );
    } catch (error) {
      showRevision(
        controller.signal.aborted
          ? "Revision canceled. Received drafts are saved."
          : error instanceof Error
            ? error.message
            : "Revision failed.",
      );
      if (controller.signal.aborted)
        setProgress("Translation canceled. Received drafts are saved.");
      else {
        setNeedsAttention(true);
        setProgress("Translation stopped. Received drafts are saved.");
        report({
          message:
            error instanceof Error ? error.message : "Translation failed.",
        });
        controller.abort();
      }
    } finally {
      if (request.current === controller) {
        if (wholeSong) setSongIncomplete(pending.size > 0);
        request.current = null;
        setRetryAt(0);
        setRunning(false);
      }
    }
  }

  const selectedDrafts = work.drafts.filter(
    (draft) => draft.phraseId === phrase?.id,
  );
  const replacementDrafts = work.drafts.filter(
    (draft) => draft.mode === "replace",
  );
  const replacementLyrics = new Set(
    replacementDrafts.map((draft) => draft.phraseId),
  ).size;
  const fillDrafts = work.drafts.filter((draft) => draft.mode === "fill");
  const eligibleFill = fillDrafts.filter((draft) => {
    const target = byPhrase(draft);
    if (
      !target ||
      !matchesBase(target, draft) ||
      draftProblems(target, draft).length
    )
      return false;
    if (draft.stage === "vocabulary") return true;
    const proposed = vocabularyFor(target);
    return (
      draft.support ===
      fingerprint(
        proposed?.mode === "fill"
          ? resultingVocabulary(target, proposed)
          : content(target, "vocabulary"),
      )
    );
  });
  function byPhrase(draft: Draft) {
    return project.phrases.find((target) => target.id === draft.phraseId);
  }
  const openRevision = (stages: Stage[], wordIndex?: number, draft?: Draft) => {
    if (!phrase) return;
    setInstruction("");
    setRevisionTarget({ phraseId: phrase.id, stages, wordIndex, draft });
  };
  const revise = () => {
    if (
      !phrase ||
      revisionTarget?.phraseId !== phrase.id ||
      !instruction.trim()
    )
      return;
    const { stages, wordIndex, draft } = revisionTarget;
    void run(
      stages.map((stage) => ({ target: phrase, stage })),
      draft?.mode ?? "replace",
      {
        instruction: instruction.trim(),
        wordIndex,
        draft,
      },
    );
    setRevisionTarget(undefined);
  };
  const updateDraft = (draft: Draft, value: DraftValue) =>
    update((state) => ({
      ...state,
      drafts: state.drafts.map((item) =>
        item.id === draft.id
          ? {
              ...item,
              value,
              provenance: { ...item.provenance, manuallyEdited: true },
            }
          : item,
      ),
    }));
  const dismiss = (id: string) =>
    update((state) => ({
      ...state,
      drafts: state.drafts.filter((draft) => draft.id !== id),
    }));

  const preview: DraftPreview = {
    wordProvider: catalog[provider]?.length
      ? {
          provider,
          model: settings.model,
          structured: settings.structured,
          thinkingEffort: settings.thinkingEffort,
        }
      : undefined,
    sentences: {},
    actions: {},
  };
  const wordDraft = selectedDrafts.find(
    (draft) => draft.stage === "vocabulary",
  );
  if (phrase) {
    for (const draft of selectedDrafts) {
      const name = stageLabels[draft.stage];
      preview.actions[draft.stage] = (
        <div className="field-draft-actions">
          <button
            aria-label={`Revise ${name} draft`}
            disabled={running || !fresh(phrase, draft)}
            onClick={() => openRevision([draft.stage], draft.wordIndex, draft)}
          >
            Revise
          </button>
          <button
            aria-label={`Dismiss ${name} draft`}
            disabled={draftLocked}
            onClick={() => dismiss(draft.id)}
          >
            Dismiss
          </button>
        </div>
      );
    }
    if (!wordDraft || fresh(phrase, wordDraft)) {
      preview.wordAction = (index) => (
        <button
          className="word-revision"
          disabled={running}
          onClick={() => openRevision(["vocabulary"], index, wordDraft)}
        >
          Revise this word
        </button>
      );
    }
    if (
      wordDraft &&
      matchesBase(phrase, wordDraft) &&
      Array.isArray(wordDraft.value)
    ) {
      const words = resultingVocabulary(phrase, wordDraft);
      const sameBoundaries =
        words.length === phrase.words.length &&
        words.every((word, i) => word.hanzi === phrase.words[i].hanzi);
      const wordField = (
        index: number,
        field: "pinyin" | "gloss",
      ): DraftField | undefined => {
        const draftIndex =
          wordDraft.wordIndex === undefined
            ? index
            : wordDraft.wordIndex === index
              ? 0
              : -1;
        const proposed = Array.isArray(wordDraft.value)
          ? wordDraft.value[draftIndex]
          : undefined;
        if (!proposed) return undefined;
        const current = sameBoundaries ? phrase.words[index] : undefined;
        const reading = field === "pinyin";
        const previous =
          (reading ? current?.pinyin : current?.translation.en) ?? "";
        return {
          previous,
          value: reading ? proposed.pinyin : proposed.translation.en,
          readOnly:
            draftLocked ||
            (!!previous.trim() &&
              (reading
                ? wordDraft.mode === "fill" || wordDraft.glossesOnly === true
                : wordDraft.mode === "fill")),
          edit: (value) => {
            if (Array.isArray(wordDraft.value))
              updateDraft(
                wordDraft,
                wordDraft.value.map((word, i) =>
                  i !== draftIndex
                    ? word
                    : reading
                      ? { ...word, pinyin: value }
                      : { ...word, translation: { en: value } },
                ),
              );
          },
        };
      };
      preview.vocabulary = {
        words,
        previousBoundaries: sameBoundaries
          ? undefined
          : phrase.words.map((word) => word.hanzi || "Note").join(" / "),
        pinyin: (index) => wordField(index, "pinyin"),
        gloss: (index) => wordField(index, "gloss"),
      };
    }
    for (const draft of selectedDrafts) {
      if (
        draft.stage === "vocabulary" ||
        typeof draft.value !== "string" ||
        !fresh(phrase, draft)
      )
        continue;
      preview.sentences[draft.stage] = {
        previous: phrase.translation[draft.stage],
        value: draft.value,
        readOnly: draftLocked,
        edit: (value) => updateDraft(draft, value),
      };
    }
  }
  const draftedLyrics = ordered.filter((target) =>
    work.drafts.some((draft) => draft.phraseId === target.id),
  );
  const next =
    draftedLyrics.find((target) => target.id !== phrase?.id) &&
    draftedLyrics[
      (draftedLyrics.findIndex((target) => target.id === phrase?.id) + 1) %
        draftedLyrics.length
    ];
  const reviewActions = phrase && (
    <div className="translation-review-actions">
      {running && (
        <p className="muted">
          {draftLocked
            ? "Draft actions unlock when this lyric’s requests finish."
            : "You can edit and apply these drafts. Model revisions are available after the run ends."}
        </p>
      )}
      <div className="actions wrap">
        {selectedDrafts.length > 0 && (
          <button
            className="primary"
            disabled={
              draftLocked ||
              !selectedDrafts.some((draft) =>
                canApplyDraft(phrase, draft, vocabularyFor(phrase)),
              )
            }
            onClick={() =>
              apply((latest) =>
                applyDrafts(
                  latest,
                  selectedDrafts.map((draft) => draft.id),
                  false,
                ),
              )
            }
          >
            {selectedDrafts.length > 1
              ? "Apply all drafts for this lyric"
              : "Apply draft"}
          </button>
        )}
        {next && <button onClick={() => selectPhrase(next)}>Next draft</button>}
        <button
          disabled={running}
          onClick={() => {
            setInstruction("");
            setRevisionTarget({
              phraseId: phrase.id,
              stages: [...stages],
              chooseParts: true,
            });
          }}
        >
          Revise lyric…
        </button>
        {selectedDrafts.length > 0 && (
          <details>
            <summary>Draft sources</summary>
            <ul>
              {selectedDrafts.map((draft) => (
                <li key={draft.id}>
                  {stageLabels[draft.stage]} · {draft.provenance.provider} ·{" "}
                  {draft.provenance.model} · {draft.provenance.promptVersion}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {revisionResult?.phraseId === phrase.id && (
        <p role="status">{revisionResult.message}</p>
      )}
      {selectedDrafts.some((draft) => !fresh(phrase, draft)) && (
        <p className="warning">
          A draft is stale. Generate a new draft from the current lyric.
        </p>
      )}
      {selectedDrafts
        .filter((draft) => fresh(phrase, draft))
        .flatMap((draft) =>
          [
            ...draftProblems(phrase, draft),
            ...alignmentWarnings(draft.value),
          ].map((issue, i) => (
            <p className="warning" key={`${draft.id}-${i}`}>
              {issue}
            </p>
          )),
        )}
      {revisionTarget?.phraseId === phrase.id && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            revise();
          }}
        >
          {revisionTarget.chooseParts && (
            <fieldset>
              <legend>Parts to revise for this lyric</legend>
              {stages.map((stage) => (
                <label key={stage}>
                  <input
                    type="checkbox"
                    checked={revisionTarget.stages.includes(stage)}
                    onChange={(event) =>
                      setRevisionTarget({
                        ...revisionTarget,
                        stages: event.target.checked
                          ? [...revisionTarget.stages, stage]
                          : revisionTarget.stages.filter(
                              (item) => item !== stage,
                            ),
                      })
                    }
                  />
                  {stageLabels[stage]}
                </label>
              ))}
            </fieldset>
          )}
          <p>
            {provider} · {settings.model} will use the song context and your
            instructions to generate a draft for review.
          </p>
          <label>
            Revision instructions {!revisionTarget.chooseParts && "· "}
            {!revisionTarget.chooseParts &&
              (revisionTarget.wordIndex === undefined
                ? revisionTarget.stages
                    .map((stage) => stageLabels[stage])
                    .join(", ")
                : resultingVocabulary(phrase, revisionTarget.draft)[
                    revisionTarget.wordIndex
                  ]?.hanzi || "Selected word")}
            <textarea
              placeholder={
                revisionTarget.wordIndex !== undefined
                  ? "For example, check this word’s pronunciation and give its closest meaning in this line."
                  : revisionTarget.stages.length === 1 &&
                      revisionTarget.stages[0] === "vocabulary"
                    ? "For example, keep only meanings that fit this line and remove repeated glosses."
                    : "For example, keep the singer speaking in the first person and use everyday language."
              }
              value={instruction}
              maxLength={4000}
              autoFocus
              onChange={(event) => setInstruction(event.target.value)}
            />
          </label>
          <div className="actions wrap">
            <button
              className="primary"
              disabled={
                running ||
                !catalog[provider] ||
                !revisionTarget.stages.length ||
                !instruction.trim()
              }
            >
              Generate revision
            </button>
            <button type="button" onClick={() => setRevisionTarget(undefined)}>
              Cancel revision
            </button>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <div hidden={hidden}>
      <div className="translation-toolbar">
        <div className="actions wrap">
          <label>
            Provider{" "}
            <select
              disabled={running || !Object.keys(catalog).length}
              value={provider}
              onChange={(e) => {
                const name = e.target.value as Provider;
                setSettings({
                  ...settings,
                  provider: name,
                  thinkingEffort: undefined,
                  model: catalog[name]![0],
                });
              }}
            >
              {(["Groq", "Gemini"] as const).map((name) => (
                <option disabled={!catalog[name]} key={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Translation model{" "}
            <select
              disabled={running || !catalog[provider]}
              value={settings.model}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  model: e.target.value,
                  thinkingEffort: undefined,
                })
              }
            >
              {(catalog[provider] || []).map((model) => (
                <option key={model}>{model}</option>
              ))}
              {!catalog[provider]?.includes(settings.model) && (
                <option>{settings.model}</option>
              )}
            </select>
          </label>
          {provider === "Groq" && (
            <label>
              Thinking effort
              <select
                value={settings.thinkingEffort ?? ""}
                disabled={running || !catalog[provider]}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    thinkingEffort: e.target.value
                      ? effortSchema.parse(e.target.value)
                      : undefined,
                  })
                }
              >
                <option value="">
                  {settings.model.startsWith("qwen/")
                    ? "Off (model default)"
                    : "Medium (model default)"}
                </option>
                {settings.model.startsWith("qwen/") && (
                  <option value="none">Off</option>
                )}
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          )}
          {song.length > 0 && (
            <button
              className="primary"
              disabled={running || !catalog[provider]}
              onClick={() => {
                void run(song, "fill", undefined, false, true);
              }}
            >
              {songIncomplete
                ? "Retry unfinished"
                : draftedLyrics.length
                  ? "Translate remaining lyrics"
                  : "Translate whole song"}
            </button>
          )}
          {draftedLyrics.length > 0 && (
            <button
              className={song.length ? undefined : "primary"}
              onClick={() => selectPhrase(draftedLyrics[0])}
            >
              Review drafts for {draftedLyrics.length}{" "}
              {draftedLyrics.length === 1 ? "lyric" : "lyrics"}
            </button>
          )}
          {fillDrafts.length > 0 && (
            <button
              disabled={!eligibleFill.length || running}
              onClick={() =>
                apply((latest) =>
                  applyDrafts(
                    latest,
                    eligibleFill.map((draft) => draft.id),
                    true,
                  ),
                )
              }
            >
              Fill missing fields with {eligibleFill.length}{" "}
              {eligibleFill.length === 1 ? "draft" : "drafts"}
            </button>
          )}
          {secondaryAction}
          <details className="translation-options">
            <summary>Translation options</summary>
            <fieldset disabled={running}>
              <legend>Generate drafts</legend>
              <label>
                Scope{" "}
                <select
                  value={scope}
                  onChange={(e) =>
                    setScope(e.target.value === "song" ? "song" : "lyric")
                  }
                >
                  <option value="lyric">Selected lyric</option>
                  <option value="song">Whole song</option>
                </select>
              </label>
              {stages.map((stage) => (
                <label key={stage}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(stage)}
                    onChange={(e) =>
                      setChosen(
                        e.target.checked
                          ? [...chosen, stage]
                          : chosen.filter((item) => item !== stage),
                      )
                    }
                  />{" "}
                  {stageLabels[stage]}
                </label>
              ))}
              <details>
                <summary>Model settings</summary>
                <label>
                  Model{" "}
                  <input
                    disabled={provider === "Groq"}
                    value={settings.model}
                    maxLength={150}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        model: e.target.value,
                        thinkingEffort: undefined,
                      })
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.structured}
                    onChange={(e) =>
                      setSettings({ ...settings, structured: e.target.checked })
                    }
                  />{" "}
                  Use structured JSON output
                </label>
                <label>
                  Song notes{" "}
                  <textarea
                    value={settings.notes}
                    maxLength={12000}
                    onChange={(e) =>
                      setSettings({ ...settings, notes: e.target.value })
                    }
                  />
                </label>
              </details>
              <div>
                <button
                  disabled={!fill.length}
                  onClick={() => void run(fill, "fill")}
                >
                  Fill missing
                </button>{" "}
                <small>{count(fill)}</small>
              </div>
              <div>
                <button
                  disabled={!replace.length}
                  onClick={() => void run(replace, "replace")}
                >
                  Draft replacements
                </button>{" "}
                <small>{count(replace)}</small>
              </div>
              <button
                disabled={!targets.some((target) => target.words.length)}
                onClick={() =>
                  void run(
                    plan("replace", targets, ["vocabulary"], true),
                    "replace",
                    undefined,
                    true,
                  )
                }
              >
                Draft replacement glosses
              </button>
              <small>
                Replacement glosses regenerate English word meanings for the
                existing word rows and preserve their supplied readings.
              </small>
            </fieldset>
          </details>
        </div>
        {(availability || !catalog[provider]) && (
          <small role="status">
            {availability === null
              ? "Loading translation models…"
              : availability || "Select a configured provider."}
          </small>
        )}
        {replacementDrafts.length > 0 && (
          <small role="status">
            {replacementDrafts.length} replacement{" "}
            {replacementDrafts.length === 1 ? "draft needs" : "drafts need"}{" "}
            individual review on {replacementLyrics}{" "}
            {replacementLyrics === 1 ? "lyric" : "lyrics"}.
          </small>
        )}
        {song.length > 0 && (
          <small>
            {songCount} {songCount === 1 ? "unique lyric" : "unique lyrics"} ·
            Vocabulary, Pinyin, English and Polish
          </small>
        )}
        {progress && (
          <div className="translation-status">
            <div role="status">
              {running && (
                <small>
                  {provider} · {settings.model} · {counts.ready}/{counts.total}{" "}
                  drafts ready
                </small>
              )}
              <p>
                {progress}
                {retryAt > 0 && ` · retry in ${seconds}s`}
                {running && eta && !retryAt && ` · about ${eta}s remaining`}
              </p>
              {running && (
                <progress
                  value={counts.ready}
                  max={counts.total}
                  aria-label="Validated translation drafts"
                />
              )}
              {running && counts.ready < counts.total && (
                <small>
                  {" "}
                  {Math.floor((100 * counts.ready) / counts.total)}%
                </small>
              )}
            </div>
            {needsAttention && (
              <button onClick={() => setNeedsAttention(false)}>
                Dismiss notification
              </button>
            )}
            {running && (
              <button onClick={() => request.current?.abort()}>
                Cancel translation
              </button>
            )}
          </div>
        )}
        {(details.length > 0 || exchanges.length > 0) && (
          <details
            className="translation-run-details"
            onToggle={scrollToLatestDetail}
          >
            <summary>Run details</summary>
            {details.length > 0 && (
              <ul
                ref={detailsList}
                tabIndex={0}
                aria-label="Translation run messages"
                onScroll={(event) => {
                  const list = event.currentTarget;
                  followDetails.current =
                    list.scrollHeight - list.scrollTop - list.clientHeight <= 8;
                }}
              >
                {details.map(({ message, stage, lyrics }, index) => (
                  <li key={index}>
                    {stage && <strong>{stageLabels[stage]} · </strong>}
                    {message}
                    {!!lyrics?.length && (
                      <div className="muted">{lyrics.join(" · ")}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {exchanges.length > 0 && (
              <details>
                <summary>
                  Debug prompts and responses ({exchanges.length})
                </summary>
                {exchanges.map((exchange, index) => (
                  <details key={exchange.id} className="translation-exchange">
                    <summary>
                      {index + 1}. {exchange.label}
                    </summary>
                    <label>
                      Prompt
                      <textarea readOnly rows={8} value={exchange.prompt} />
                    </label>
                    <label>
                      Model response
                      <textarea
                        readOnly
                        rows={8}
                        value={exchange.response ?? ""}
                        placeholder={
                          exchange.response === undefined
                            ? "No model response recorded"
                            : "The model returned empty text"
                        }
                      />
                    </label>
                  </details>
                ))}
              </details>
            )}
          </details>
        )}
      </div>
      {!hidden && children(preview, reviewActions)}
    </div>
  );
}
