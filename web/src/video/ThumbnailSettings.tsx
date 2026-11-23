import { lazy, Suspense } from "react";
import type { Project } from "../domain.ts";
import type { VideoSettings } from "./video-settings.ts";
import { resolveThumbnail, thumbnailModeSettings } from "./video-settings.ts";
import { AssetPicker, useAssetFile, useAssetUrl } from "./video-assets.tsx";
const Still = lazy(() => import("./ThumbnailPreview.tsx"));
export function ThumbnailSettings({
  project,
  s,
  save,
}: {
  project: Project;
  s: VideoSettings;
  save: (s: VideoSettings) => void;
}) {
  const t = thumbnailModeSettings(s);
  const update = (patch: Partial<typeof t>) =>
    save({
      ...s,
      thumbnailModes: { ...s.thumbnailModes, [t.mode]: { ...t, ...patch } },
    });
  const art = s.designs.find(
    (d) => d.id === s.activeDesign && d.kind === "image",
  )?.asset;
  const src = useAssetUrl(useAssetFile(t.asset));
  let props, issue;
  try {
    props = resolveThumbnail(project);
  } catch (err) {
    issue = String(err);
  }
  return (
    <section>
      <h2>Thumbnail</h2>
      <label>
        Mode
        <select
          value={t.mode}
          onChange={(e) =>
            save({
              ...s,
              thumbnail: {
                ...s.thumbnail,
                mode: e.target.value as typeof t.mode,
              },
            })
          }
        >
          {["full", "only-pinyin", "title-only"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <AssetPicker
        label="Thumbnail artwork"
        kind="image"
        asset={t.asset}
        onChange={(asset) => update({ asset })}
      />
      {art && (
        <button onClick={() => update({ asset: art })}>
          Use video artwork
        </button>
      )}
      <label>
        Music note color
        <input
          type="color"
          value={t.notesColor ?? "#ffffff"}
          onChange={(e) => update({ notesColor: e.target.value })}
        />
      </label>
      {(["title", "top", "bottom", "notes"] as const)
        .filter((k) =>
          k === "title"
            ? t.mode !== "only-pinyin"
            : k === "bottom"
              ? t.mode === "only-pinyin"
              : true,
        )
        .map((k) => (
          <label key={k}>
            {
              {
                title: "English title",
                top: "Top label",
                bottom: "Bottom label",
                notes: "Music notes",
              }[k]
            }
            <input
              value={
                t[k] ??
                (k === "title"
                  ? project.metadata.title
                  : project.metadata.artist)
              }
              onChange={(e) => update({ [k]: e.target.value })}
            />
          </label>
        ))}
      <label>
        Artwork opacity
        <input
          type="range"
          min="0"
          max="1"
          step=".05"
          value={t.opacity}
          onChange={(e) => update({ opacity: Number(e.target.value) })}
        />
      </label>
      {t.mode !== "title-only" && (
        <>
          {t.words.map((w, i) => (
            <fieldset key={i}>
              <legend>Title word {i + 1}</legend>
              {(["hanzi", "pinyin", "translation"] as const).map((k) => (
                <label key={k}>
                  {k}
                  <input
                    value={w[k]}
                    onChange={(e) =>
                      update({
                        words: t.words.map((v, j) =>
                          j === i ? { ...v, [k]: e.target.value } : v,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <button
                onClick={() =>
                  update({ words: t.words.filter((_, j) => j !== i) })
                }
              >
                Remove word
              </button>
            </fieldset>
          ))}
          <button
            onClick={() =>
              update({
                words: [...t.words, { hanzi: "", pinyin: "", translation: "" }],
              })
            }
          >
            Add title word
          </button>
        </>
      )}
      {props && src ? (
        <Suspense fallback={<p>Loading thumbnail…</p>}>
          <Still {...props} bgImageSrc={src} />
        </Suspense>
      ) : (
        <p>{issue ?? "Relink thumbnail artwork."}</p>
      )}
    </section>
  );
}
