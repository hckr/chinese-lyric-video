import { formatTime } from "../timing/timing.ts";
import { parseVideoTime } from "./video-time.ts";
import { DesignSettings } from "./DesignSettings.tsx";
import { ThumbnailSettings } from "./ThumbnailSettings.tsx";
import { lazy, Suspense, useContext, useState } from "react";
import { AssetContext } from "./video-assets.tsx";
import { useSourceFps } from "./useSourceFps.ts";
import type { Project } from "../domain.ts";
import {
  videoSettingsSchema,
  videoVariants,
  type VideoSettings,
} from "./video-settings.ts";
const Preview = lazy(() => import("./FootagePreview.tsx"));
export function FootageSettings({
  project,
  file,
  tab,
  setTab,
  goExport,
  save,
}: {
  project: Project;
  file: File | null;
  tab: "Video" | "Thumbnail";
  setTab: (tab: "Video" | "Thumbnail") => void;
  goExport: () => void;
  save: (settings: VideoSettings) => void;
}) {
  const s = project.videoSettings ?? videoSettingsSchema.parse({});
  const { files } = useContext(AssetContext);
  const design = s.designs.find((item) => item.id === s.activeDesign);
  const frameSource =
    design?.kind === "image"
      ? undefined
      : design?.asset
        ? files.get(design.asset.id)
        : file;
  const measured = useSourceFps(frameSource);
  const fps = measured?.fps ?? (design?.kind === "image" ? 30 : 25);
  const [error, setError] = useState("");
  const [previewRequested, setPreviewRequested] = useState(false);

  return (
    <section>
      <div className="video-tabs" role="group" aria-label="Video settings tabs">
        {(["Video", "Thumbnail"] as const).map((t) => (
          <button
            key={t}
            aria-pressed={t === tab}
            onClick={() => {
              if (t === "Thumbnail") setPreviewRequested(false);
              setTab(t);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Thumbnail" ? (
        <ThumbnailSettings project={project} s={s} save={save} />
      ) : (
        <div className="design-workspace">
          <div>
            <DesignSettings key={s.activeDesign} s={s} save={save} />
            <p>
              Soundtrack ·{" "}
              {s.soundtrack?.name ??
                project.audio?.name ??
                "Choose song media in Timing"}
            </p>
            <label>
              Output variant
              <select
                value={s.variant}
                onChange={(e) =>
                  save({
                    ...s,
                    variant: videoSettingsSchema.shape.variant.parse(
                      e.target.value,
                    ),
                  })
                }
              >
                {Object.entries(videoVariants).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {s.variant === "short" && (
              <form
                key={JSON.stringify(s.excerpt)}
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  const excerpt = {
                    startMs: parseVideoTime(String(data.get("start"))),
                    endMs: parseVideoTime(String(data.get("end"))),
                  };
                  if (
                    !Number.isFinite(excerpt.endMs + excerpt.startMs) ||
                    excerpt.endMs <= excerpt.startMs ||
                    !(s.soundtrack?.durationMs ?? project.audio?.durationMs) ||
                    excerpt.endMs >
                      (s.soundtrack?.durationMs ??
                        project.audio?.durationMs ??
                        0) ||
                    Math.round((excerpt.endMs * fps) / 1000) <=
                      Math.round((excerpt.startMs * fps) / 1000)
                  ) {
                    setError(
                      "Select at least one frame within the attached soundtrack.",
                    );
                    return;
                  }
                  save({ ...s, excerpt });
                  setError("");
                }}
              >
                <label>
                  Start (m:ss.mmm)
                  <input
                    required
                    name="start"
                    type="text"
                    min="0"
                    defaultValue={formatTime(s.excerpt?.startMs ?? 0)}
                  />
                </label>
                <label>
                  End (m:ss.mmm)
                  <input
                    required
                    name="end"
                    type="text"
                    min="1"
                    defaultValue={s.excerpt ? formatTime(s.excerpt.endMs) : ""}
                  />
                </label>
                <label>
                  Use a timed lyric
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const cue = project.occurrences.find(
                        (o) => o.id === e.target.value,
                      );
                      if (cue?.startMs != null && cue.endMs != null) {
                        const form = e.currentTarget.form!;
                        (
                          form.elements.namedItem("start") as HTMLInputElement
                        ).value = formatTime(cue.startMs);
                        (
                          form.elements.namedItem("end") as HTMLInputElement
                        ).value = formatTime(cue.endMs);
                      }
                    }}
                  >
                    <option value="">Choose a lyric</option>
                    {project.occurrences
                      .filter((o) => o.startMs !== null && o.endMs !== null)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {formatTime(o.startMs)} ·{" "}
                          {
                            project.phrases.find((p) => p.id === o.phraseId)
                              ?.lyricKey
                          }
                        </option>
                      ))}
                  </select>
                </label>
                <button>Apply range</button>
                {error && <p role="alert">{error}</p>}
              </form>
            )}
          </div>
          <div className="design-preview">
            {previewRequested ? (
              <>
                <button onClick={() => setPreviewRequested(false)}>
                  Close preview
                </button>
                <Suspense fallback={<p>Loading preview…</p>}>
                  <Preview project={project} file={file} />
                </Suspense>
              </>
            ) : (
              <button onClick={() => setPreviewRequested(true)}>
                Load preview
              </button>
            )}
          </div>
        </div>
      )}
      <button onClick={goExport}>Go to Export</button>
    </section>
  );
}
