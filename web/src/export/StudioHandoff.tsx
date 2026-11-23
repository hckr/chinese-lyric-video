import { sourceVideoFps } from "./export-media.ts";
import { AssetContext } from "../video/video-assets.tsx";
import {
  resolveThumbnail,
  thumbnailModeSettings,
  jobMedia,
  videoVariants,
  videoSettingsSchema,
  type VideoSettings,
  resolveFootageJob,
} from "../video/video-settings.ts";
import { useContext, useState } from "react";
import type { Project } from "../domain.ts";

async function shareAsset(file: File): Promise<string> {
  const response = await fetch("/api/render-assets", {
    method: "POST",
    headers: {
      "X-Workbench-Upload": "1",
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!response.ok)
    throw Error(
      "Could not prepare local media. Check the workbench server and retry.",
    );
  return (await response.json()).url;
}

type Prepared = { name: string; text: string; composition: string };
type Row = {
  id: string;
  label: string;
  issue?: string;
  prepare?: () => Promise<Prepared>;
  preview?: () => void;
};
const safeName = (value: string) =>
  value
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .slice(0, 65) || "song";
export function StudioHandoff({
  project,
  file,
  download,
  save,
  openVideo,
}: {
  project: Project;
  file: File | null;
  download: (name: string, text: string) => void;
  save: (s: VideoSettings) => void;
  openVideo: (tab: "Video" | "Thumbnail") => void;
}) {
  const s = project.videoSettings ?? videoSettingsSchema.parse({});
  const { files } = useContext(AssetContext);
  const [results, setResults] = useState<Record<string, Prepared | string>>({});
  const [busy, setBusy] = useState(false);
  const urls = new Map<File, Promise<string>>();
  const share = (f: File) => {
    const existing = urls.get(f);
    if (existing) return existing;
    const next = shareAsset(f);
    urls.set(f, next);
    return next;
  };
  const rows: Row[] = [];
  for (const design of s.designs)
    for (const variant of Object.keys(
      videoVariants,
    ) as (keyof typeof videoVariants)[]) {
      const row: Row = {
        id: design.id + "/" + variant,
        label: design.name + " · " + videoVariants[variant],
        preview: () => {
          save({ ...s, activeDesign: design.id, variant });
          openVideo("Video");
        },
      };
      rows.push(row);
      try {
        resolveFootageJob(project, design.id, variant);
        const media = jobMedia(project, file, files, design);
        const outName = [
          safeName(project.metadata.title),
          safeName(design.name),
          safeName(design.id),
          variant,
        ].join("-");
        row.prepare = async () => {
          const fps =
            design.kind === "image" ? 30 : await sourceVideoFps(media.visual);
          const resolved = resolveFootageJob(project, design.id, variant, fps);
          return {
            name: outName + ".json",
            composition: "Workbench-Video",
            text: JSON.stringify(
              {
                ...resolved,
                outName,
                videoSrc: await share(media.visual),
                audioSrc: await share(media.audio),
              },
              null,
              2,
            ),
          };
        };
      } catch (error) {
        row.issue = error instanceof Error ? error.message : String(error);
      }
    }
  for (const mode of ["full", "only-pinyin", "title-only"] as const) {
    const row: Row = {
      id: "thumbnail/" + mode,
      label: "Thumbnail · " + mode,
      preview: () => {
        save({ ...s, thumbnail: { ...s.thumbnail, mode } });
        openVideo("Thumbnail");
      },
    };
    rows.push(row);
    try {
      const props = resolveThumbnail(project, mode);
      const art = thumbnailModeSettings(s, mode).asset!;
      const image = files.get(art.id);
      if (!image) throw Error("Relink " + art.name);
      const outName = safeName(project.metadata.title) + "-thumbnail-" + mode;
      row.prepare = async () => ({
        name: outName + ".json",
        composition: "Workbench-Thumbnail",
        text: JSON.stringify(
          { ...props, outName, bgImageSrc: await share(image) },
          null,
          2,
        ),
      });
    } catch (error) {
      row.issue = error instanceof Error ? error.message : String(error);
    }
  }
  async function prepare() {
    setBusy(true);
    try {
      for (const row of rows.filter((r) => s.selected.includes(r.id))) {
        let result;
        try {
          if (!row.prepare) throw Error(row.issue);
          result = await row.prepare();
        } catch (err) {
          result = String(err);
        }
        setResults((old) => ({ ...old, [row.id]: result }));
      }
    } finally {
      setBusy(false);
    }
  }
  function cell(row: Row) {
    return (
      <div key={row.id}>
        <label>
          <input
            type="checkbox"
            checked={s.selected.includes(row.id)}
            disabled={busy}
            onChange={(e) =>
              save({
                ...s,
                selected: e.target.checked
                  ? [...s.selected, row.id]
                  : s.selected.filter((k) => k !== row.id),
              })
            }
          />
          {row.id.startsWith("thumbnail/") ? (
            row.label
          ) : (
            <span className="job-name">{row.label}</span>
          )}
        </label>
        <small>{row.issue ?? "Ready"}</small>
        {row.preview && <button onClick={row.preview}>Preview</button>}
      </div>
    );
  }

  return (
    <section className="export-jobs">
      <h2>Prepare for Remotion Studio</h2>
      <div
        className="export-matrix"
        role="region"
        aria-label="Design and variant selection"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Design</th>
              {Object.values(videoVariants).map((v) => (
                <th key={v}>{v}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.designs.map((d) => (
              <tr key={d.id}>
                <th scope="row">{d.name}</th>
                {Object.keys(videoVariants).map((v) => (
                  <td key={v}>
                    {cell(rows.find((r) => r.id === d.id + "/" + v)!)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <fieldset>
        <legend>Thumbnail outputs</legend>
        {rows.filter((r) => r.id.startsWith("thumbnail/")).map(cell)}
      </fieldset>
      <button
        disabled={busy || !s.selected.length}
        onClick={() => void prepare()}
      >
        {busy ? "Preparing…" : "Prepare selected jobs"}
      </button>
      <div aria-live="polite">
        {Object.entries(results).map(([id, result]) =>
          typeof result === "string" ? (
            <p key={id}>
              {id}: {result}
            </p>
          ) : (
            <div key={id}>
              <button onClick={() => download(result.name, result.text)}>
                Download {result.name}
              </button>
              <p>
                Keep the workbench running. In the repository, launch Studio
                with the downloaded props, then choose {result.composition} and
                web rendering.
              </p>
              <code>
                npm run dev -- --props="$HOME/Downloads/{result.name}"
              </code>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
