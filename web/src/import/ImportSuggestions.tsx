import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  parseLines,
  sectionContext,
  type Patch,
  type Line,
} from "./lyrics-document";
import {
  defaultTranslation,
  type TranslationState,
} from "../translations/translation-schema";

import { validPieces } from "../lyric-length";

const phraseProposal = z.object({
  start: z.number().int().positive(),
  end: z.number().int().positive(),
  pieces: z.array(z.string()),
});
const proposal = z
  .object({
    name: z.string().trim().min(1).max(120),
    start: z.number().int().positive(),
    end: z.number().int().positive(),
  })
  .strict();
type Provider = "Groq" | "Gemini";

export function ImportSuggestions({
  lines,
  proposals,
  setProposals,
  report,
  settings,
  onProvider,
}: {
  onProvider: (
    p: import("../translations/WordReview").WordProvider | undefined,
  ) => void;
  lines: Line[];
  proposals: Patch[];
  setProposals: (p: Patch[]) => void;
  report: (s: string) => void;
  settings?: TranslationState["settings"];
}) {
  const [catalog, setCatalog] = useState<Partial<Record<Provider, string[]>>>(
    {},
  );
  const [provider, setProvider] = useState<Provider>(
    settings?.provider ?? "Gemini",
  );
  const [model, setModel] = useState(
    settings?.model ?? defaultTranslation.settings.model,
  );
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const cache = useRef(new Map<string, Patch[]>());
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    report(
      busy
        ? "Reviewing…"
        : proposals.length || status.startsWith("AI review failed")
          ? "!"
          : "",
    );
    return () => report("");
  }, [busy, proposals.length, status, report]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/translation/providers", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const data = await response.json();
        if (controller.signal.aborted) return;
        setCatalog(data);
        const preferred = settings?.provider;
        const available =
          preferred && data[preferred]?.length
            ? preferred
            : data.Groq?.length
              ? "Groq"
              : data.Gemini?.length
                ? "Gemini"
                : undefined;
        if (available) {
          setProvider(available);
          setModel(
            preferred === available && settings?.model
              ? settings.model
              : data[available][0],
          );
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [settings]);
  useEffect(() => {
    onProvider(
      catalog[provider]?.length
        ? { provider, model, structured: settings?.structured ?? true }
        : undefined,
    );
  }, [catalog, provider, model, settings, onProvider]);
  async function suggest() {
    const { rows, groups } = parseLines(lines);
    const request = {
      provider,
      model,
      structured: settings?.structured ?? true,
      thinkingEffort:
        provider === settings?.provider && model === settings.model
          ? settings.thinkingEffort
          : undefined,
      occurrences: rows.map((r) => r.text),
    };
    const key = JSON.stringify([request, lines]);
    const cached = cache.current.get(key);
    if (cached) {
      setProposals(cached);
      setStatus(
        cached.length
          ? "Analysis complete."
          : "No structural changes suggested.",
      );
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/suggest-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        if (!controller.signal.aborted)
          setStatus(
            typeof error?.error === "string"
              ? "AI review failed. " + error.error
              : `AI review request failed (HTTP ${response.status}). Try again or select another model.`,
          );
        return;
      }
      const responseData = z
        .object({
          groups: z.array(proposal),
          phrases: z.array(phraseProposal).default([]),
        })
        .parse(await response.json());
      const patches: Patch[] = [];
      const add = (
        label: string,
        start: number,
        end: number,
        after: string[],
      ) => {
        const before = lines.slice(start, end + 1);
        if (before.map((l) => l.text).join("\n") === after.join("\n")) return;
        patches.push({
          ids: before.map((l) => l.id),
          before: before.map((l) => l.text),
          after,
          label,
          context: sectionContext(lines, start, before.length),
        });
      };
      for (const g of responseData.groups) {
        const first = rows[g.start - 1],
          last = rows[g.end - 1];
        if (!first || !last || g.end < g.start || /[[\]\r\n]/.test(g.name))
          continue;
        const section = groups.find((s) => s.id === first.section);
        const start =
          section?.occurrenceIds[0] === first.id ? section.line : first.line;
        const next = rows[g.end];
        const after = [
          "[" + g.name + "]",
          ...lines
            .slice(first.line, last.line + 1)
            .filter((l) => l.text.trim() && !/[[\]]/.test(l.text))
            .map((l) => l.text),
        ];
        if (
          next &&
          !lines
            .slice(last.line + 1, next.line)
            .some((l) => !l.text.trim() || /[[\]]/.test(l.text))
        ) {
          const following = groups.find((s) => s.id === next.section);
          after.push(following ? "[" + following.name + "]" : "");
        }
        add("Section heading", start, last.line, after);
      }
      for (const p of responseData.phrases) {
        const selected = rows.slice(p.start - 1, p.end);
        if (
          !selected.length ||
          selected.length !== p.end - p.start + 1 ||
          selected.at(-1)!.line - selected[0].line + 1 !== selected.length ||
          !validPieces(selected.map((r) => r.text).join(""), p.pieces) ||
          p.pieces.some((t) => /[\r\n]/.test(t))
        )
          continue;
        add(
          "Phrase boundaries",
          selected[0].line,
          selected.at(-1)!.line,
          p.pieces,
        );
      }
      if (controller.signal.aborted) return;
      cache.current.set(key, patches);
      setProposals(patches);
      setStatus(
        patches.length
          ? "Analysis complete."
          : "No structural changes suggested.",
      );
    } catch {
      if (!controller.signal.aborted)
        setStatus(
          "AI review failed to return valid suggestions. Retry or edit the lyrics directly.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="import-suggestions">
      <button
        type="button"
        disabled={
          busy || !catalog[provider]?.length || !parseLines(lines).rows.length
        }
        onClick={suggest}
      >
        {busy ? "Reviewing…" : "Review with AI"}
      </button>
      {busy && (
        <button
          onClick={() => {
            active.current?.abort();
            setBusy(false);
            setStatus("Review canceled.");
          }}
        >
          Cancel review
        </button>
      )}
      {Object.keys(catalog).length ? (
        <details className="provider-popover">
          <summary>
            {provider} · {model}
          </summary>
          <div className="provider-menu">
            <label>
              Suggestion provider
              <select
                disabled={busy}
                value={provider}
                onChange={(e) => {
                  const p = e.target.value as Provider;
                  setProvider(p);
                  setModel(catalog[p]![0]);
                }}
              >
                {[...new Set([provider, ...Object.keys(catalog)])].map((p) => (
                  <option key={p} disabled={!catalog[p as Provider]?.length}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Suggestion model
              <select
                disabled={busy}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {[...new Set([model, ...(catalog[provider] ?? [])])].map(
                  (m) => (
                    <option key={m}>{m}</option>
                  ),
                )}
              </select>
            </label>
          </div>
        </details>
      ) : (
        <small>Configure a translation provider to request suggestions.</small>
      )}
      <p role="status">{status}</p>
    </div>
  );
}
