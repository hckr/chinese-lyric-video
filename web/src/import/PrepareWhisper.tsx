import { useEffect, useRef, useState } from "react";
import { timingWav } from "../timing/timing-audio";
export function PrepareWhisper({
  file,
  duration,
  onModel,
}: {
  file: File;
  duration: number;
  onModel: (model: string) => void;
}) {
  const [models, setModels] = useState<string[]>([]),
    [model, setModel] = useState("medium"),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let live = true;
    void fetch("/api/timing-models")
      .then((r) => r.json())
      .then((d) => {
        if (live && Array.isArray(d.models)) {
          setModels(d.models);
          setModel(
            d.models.includes("medium") ? "medium" : (d.models[0] ?? "medium"),
          );
        }
      })
      .catch(() => {});
    return () => {
      live = false;
      controller.current?.abort();
    };
  }, []);
  async function prepare() {
    const job = new AbortController();
    controller.current = job;
    setBusy(true);
    setStatus("Preparing local Whisper transcript…");

    try {
      const send = async (media: Blob) => {
        const response = await fetch("/api/automatic-timing", {
          method: "POST",
          signal: job.signal,
          body: new Blob([
            JSON.stringify({
              prepareOnly: true,
              durationMs: duration,
              model,
              provider: "local",
              language: "zh",
            }) + "\n",
            media,
          ]),
        });
        const packets = (await response.text())
          .trim()
          .split("\n")
          .map((s) => JSON.parse(s));
        return packets.at(-1);
      };
      let last = await send(file);
      if (last?.code === "media-decode")
        last = await send(await timingWav(file, job.signal));
      if (!last?.prepared) throw Error(last?.error ?? "Preparation failed.");
      onModel(model);
      setStatus("Word timestamps ready for Timing.");
    } catch (e) {
      if (!job.signal.aborted)
        setStatus(e instanceof Error ? e.message : "Preparation failed.");
    } finally {
      if (!job.signal.aborted) setBusy(false);
    }
  }
  return (
    <div>
      <label>
        Local Whisper model{" "}
        <select
          disabled={busy || !models.length}
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          {models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <button disabled={busy || !models.length} onClick={() => void prepare()}>
        Prepare Whisper timing
      </button>
      <span role="status">
        {status || (!models.length ? "No cached local model available." : "")}
      </span>
    </div>
  );
}
