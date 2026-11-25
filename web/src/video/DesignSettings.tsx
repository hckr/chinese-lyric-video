import { formatTime } from "../timing/timing.ts";
import { parseVideoTime } from "./video-time.ts";
import { designSchema, initialDesign, type Design } from "./designs.ts";
import { thumbnailModeSettings, type VideoSettings } from "./video-settings.ts";
import { AssetPicker } from "./video-assets.tsx";

export function DesignSettings({
  s,
  save,
  songDurationMs,
}: {
  s: VideoSettings;
  save: (s: VideoSettings) => void;
  songDurationMs?: number;
}) {
  const thumbnailArt = thumbnailModeSettings(s).asset;
  const d = s.designs.find((v) => v.id === s.activeDesign) ?? s.designs[0];
  const videoDurationMs = d.asset?.durationMs;
  const diffMs =
    songDurationMs !== undefined && videoDurationMs !== undefined
      ? songDurationMs - videoDurationMs
      : undefined;
  const update = (patch: Partial<Design>) =>
    save({
      ...s,
      designs: s.designs.map((v) => (v.id === d.id ? { ...v, ...patch } : v)),
    });
  const add = (duplicate: boolean) => {
    const base = duplicate ? structuredClone(d) : initialDesign();
    const next = {
      ...base,
      id: crypto.randomUUID(),
      name: duplicate ? d.name + " copy" : "New design",
    };
    save({ ...s, activeDesign: next.id, designs: [...s.designs, next] });
  };
  const layout = d.overrides[s.variant] ?? {
    scale: 1,
    vertical: 0,
    english: true,
    polish: true,
    gloss: true,
    hanzi: true,
  };
  const override = (patch: Partial<typeof layout>) =>
    update({
      overrides: { ...d.overrides, [s.variant]: { ...layout, ...patch } },
    });
  return (
    <>
      <label>
        Visual design
        <select
          value={d.id}
          onChange={(e) => save({ ...s, activeDesign: e.target.value })}
        >
          {s.designs.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <button onClick={() => add(false)}>New design</button>
      <button onClick={() => add(true)}>Duplicate</button>
      <button
        disabled={s.designs.length === 1}
        onClick={() => {
          const references = s.selected.filter((k) => k.startsWith(d.id + "/"));
          if (
            references.length &&
            !confirm("Remove this design and its selected exports?")
          )
            return;
          const designs = s.designs.filter((v) => v.id !== d.id);
          save({
            ...s,
            designs,
            activeDesign: designs[0].id,
            selected: s.selected.filter((k) => !references.includes(k)),
          });
        }}
      >
        Remove
      </button>
      <label>
        Design name
        <input
          key={d.id + d.name}
          defaultValue={d.name}
          onBlur={(e) => {
            if (e.target.value.trim()) update({ name: e.target.value.trim() });
            else e.target.value = d.name;
          }}
        />
      </label>
      <label>
        Background
        <select
          value={d.kind}
          onChange={(e) => {
            const kind = designSchema.shape.kind.parse(e.target.value);
            update({
              kind,
              asset: undefined,
              startMs: 0,
              endMs: undefined,
              freezeStartMs: 0,
              dim: kind === "original",
              bassPulse: kind === "image",
              visualizer: kind === "image",
            });
          }}
        >
          <option value="original">Original footage</option>
          <option value="image">Still artwork</option>
          <option value="loop">Looping video</option>
        </select>
      </label>
      <AssetPicker
        label={
          d.kind === "original"
            ? "Alternate footage"
            : d.kind === "image"
              ? "Artwork"
              : "Loop clip"
        }
        kind={d.kind === "image" ? "image" : "video"}
        asset={d.asset}
        onChange={(asset) =>
          update({
            asset,
            startMs: 0,
            endMs: undefined,
            freezeStartMs: 0,
          })
        }
      />
      {d.kind === "image" && thumbnailArt && (
        <button onClick={() => update({ asset: thumbnailArt })}>
          Use thumbnail artwork
        </button>
      )}
      {d.kind === "original" && d.asset && (
        <button onClick={() => update({ asset: undefined, freezeStartMs: 0 })}>
          Use imported footage
        </button>
      )}
      <label>
        Framing
        <select
          value={d.fit}
          onChange={(e) => update({ fit: e.target.value as Design["fit"] })}
        >
          <option>cover</option>
          <option>contain</option>
        </select>
      </label>
      {d.kind === "original" && (
        <>
          <label>
            Freeze first frame (ms)
            <input
              type="number"
              min="0"
              step="100"
              key={d.id + "/freezeStart/" + d.freezeStartMs}
              defaultValue={d.freezeStartMs}
              onBlur={(e) => {
                const val = Number(e.currentTarget.value);
                if (Number.isFinite(val) && val >= 0) {
                  update({ freezeStartMs: Math.round(val) });
                } else {
                  e.currentTarget.value = String(d.freezeStartMs);
                }
              }}
            />
            {d.freezeStartMs > 0 && (
              <small>{formatTime(d.freezeStartMs)} lead-in</small>
            )}
          </label>
          {songDurationMs !== undefined && videoDurationMs !== undefined && (
            <p>
              Duration · Song: {formatTime(songDurationMs)} (
              {songDurationMs.toLocaleString()} ms) · Video:{" "}
              {formatTime(videoDurationMs)} ({videoDurationMs.toLocaleString()}{" "}
              ms) ·{" "}
              <strong>
                {diffMs === 0
                  ? "Identical length"
                  : diffMs !== undefined && diffMs > 0
                    ? `Video is ${diffMs.toLocaleString()} ms shorter`
                    : `Video is ${(-diffMs!).toLocaleString()} ms longer`}
              </strong>
              {diffMs !== undefined &&
                diffMs > 0 &&
                d.freezeStartMs !== diffMs && (
                  <button
                    type="button"
                    onClick={() => update({ freezeStartMs: diffMs })}
                    style={{ marginLeft: "0.5rem" }}
                  >
                    Set delay to difference ({diffMs.toLocaleString()} ms)
                  </button>
                )}
            </p>
          )}
        </>
      )}
      {d.kind === "loop" && (
        <>
          <label>
            Playback
            <select
              value={d.loop}
              onChange={(e) =>
                update({ loop: e.target.value as Design["loop"] })
              }
            >
              {["repeat", "ping-pong", "once"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <form
            key={[d.id, d.startMs, d.endMs, d.asset?.id].join("/")}
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const start = form.elements.namedItem(
                "start",
              ) as HTMLInputElement;
              const end = form.elements.namedItem("end") as HTMLInputElement;
              const startMs = parseVideoTime(start.value),
                endMs = parseVideoTime(end.value);
              if (
                !Number.isFinite(startMs + endMs) ||
                endMs <= startMs ||
                endMs > (d.asset?.durationMs ?? 0)
              ) {
                end.setCustomValidity(
                  "Enter a valid range inside the attached clip.",
                );
                end.reportValidity();
                return;
              }
              update({ startMs, endMs });
            }}
          >
            <label>
              Clip start (m:ss.mmm)
              <input
                required
                name="start"
                defaultValue={formatTime(d.startMs)}
                onInput={(e) =>
                  (
                    e.currentTarget.form!.elements.namedItem(
                      "end",
                    ) as HTMLInputElement
                  ).setCustomValidity("")
                }
              />
            </label>
            <label>
              Clip end (m:ss.mmm)
              <input
                required
                name="end"
                defaultValue={formatTime(d.endMs ?? d.asset?.durationMs ?? 0)}
                onInput={(e) => e.currentTarget.setCustomValidity("")}
              />
            </label>
            <button>Apply trim</button>
          </form>
          <label>
            Playback speed
            <input
              type="number"
              min=".05"
              max="4"
              step=".05"
              defaultValue={d.speed}
              key={d.speed}
              onBlur={(e) => {
                if (e.currentTarget.value && e.currentTarget.validity.valid)
                  update({ speed: Number(e.currentTarget.value) });
                else e.currentTarget.value = String(d.speed);
              }}
            />
          </label>
        </>
      )}
      {(["dim", "visualizer", "bassPulse"] as const).map((key, i) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={d[key]}
            onChange={(e) => update({ [key]: e.target.checked })}
          />
          {["Dim active lyrics", "Visualizer", "Bass pulse"][i]}
        </label>
      ))}
      {d.visualizer && (
        <>
          <label>
            Visualizer style
            <select
              value={d.bars}
              onChange={(e) =>
                update({ bars: e.target.value as Design["bars"] })
              }
            >
              <option value="both">Top and bottom bars</option>
              <option value="top">Top bars</option>
              <option value="bottom">Bottom bars</option>
            </select>
          </label>
          <label>
            Visualizer color
            <input
              type="color"
              value={d.color}
              onChange={(e) => update({ color: e.target.value })}
            />
          </label>
          <label>
            Intensity
            <input
              type="range"
              min="0"
              max="2"
              step=".1"
              value={d.intensity}
              onChange={(e) => update({ intensity: Number(e.target.value) })}
            />
          </label>
        </>
      )}
      <details>
        <summary>Layout and branding for this variant</summary>
        <label>
          Variant framing
          <select
            value={layout.fit ?? ""}
            onChange={(e) =>
              override({
                fit: e.target.value
                  ? (e.target.value as Design["fit"])
                  : undefined,
              })
            }
          >
            <option value="">Use design framing</option>
            <option>cover</option>
            <option>contain</option>
          </select>
        </label>
        <label>
          Horizontal safe margin (%)
          <input
            type="range"
            min="0"
            max="20"
            value={layout.margin ?? 0}
            onChange={(e) => override({ margin: Number(e.target.value) })}
          />
        </label>
        {s.variant !== "no-pinyin" && s.variant !== "only-pinyin" && (
          <label>
            <input
              type="checkbox"
              checked={layout.pinyin ?? true}
              onChange={(e) => override({ pinyin: e.target.checked })}
            />
            Pinyin
          </label>
        )}
        <label>
          <input
            type="checkbox"
            checked={layout.watermark ?? s.showWatermark}
            onChange={(e) => override({ watermark: e.target.checked })}
          />
          Show watermark
        </label>
        <label>
          <input
            type="checkbox"
            checked={layout.outro ?? false}
            onChange={(e) => override({ outro: e.target.checked })}
          />
          Closing thank-you and subscribe sequence
        </label>
        {layout.outro && (
          <div style={{ paddingLeft: "1.25rem" }}>
            <label>
              <input
                type="checkbox"
                checked={layout.outroFreeze ?? false}
                onChange={(e) => override({ outroFreeze: e.target.checked })}
              />
              Extend video with freeze frame after song
            </label>
            {layout.outroFreeze && (
              <>
                <label>
                  Overlap with song (ms)
                  <input
                    type="number"
                    min="0"
                    step="100"
                    key={
                      d.id +
                      "/" +
                      s.variant +
                      "/overlap/" +
                      (layout.outroOverlapMs ?? 0)
                    }
                    defaultValue={layout.outroOverlapMs ?? 0}
                    onBlur={(e) => {
                      const val = Number(e.currentTarget.value);
                      if (Number.isFinite(val) && val >= 0) {
                        override({ outroOverlapMs: Math.round(val) });
                      } else {
                        e.currentTarget.value = String(
                          layout.outroOverlapMs ?? 0,
                        );
                      }
                    }}
                  />
                </label>
                {(layout.outroOverlapMs ?? 0) !==
                  (layout.outroPart1Ms ?? 3500) && (
                  <button
                    type="button"
                    onClick={() =>
                      override({ outroOverlapMs: layout.outroPart1Ms ?? 3500 })
                    }
                    style={{ marginBottom: "0.5rem" }}
                  >
                    Match Part 1 duration ({layout.outroPart1Ms ?? 3500} ms)
                  </button>
                )}
                {(layout.outroOverlapMs ?? 0) > 0 && (
                  <p>
                    <small>
                      {formatTime(layout.outroOverlapMs ?? 0)} plays before song
                      ends; remainder plays on extended freeze frame.
                    </small>
                  </p>
                )}
              </>
            )}
            <label>
              Part 1 duration (ms) · "Thank you for watching"
              <input
                type="number"
                min="500"
                step="100"
                key={
                  d.id +
                  "/" +
                  s.variant +
                  "/part1/" +
                  (layout.outroPart1Ms ?? 3500)
                }
                defaultValue={layout.outroPart1Ms ?? 3500}
                onBlur={(e) => {
                  const val = Number(e.currentTarget.value);
                  if (Number.isFinite(val) && val >= 500) {
                    override({ outroPart1Ms: Math.round(val) });
                  } else {
                    e.currentTarget.value = String(layout.outroPart1Ms ?? 3500);
                  }
                }}
              />
            </label>
            <label>
              Part 2 duration (ms) · "Please like and subscribe"
              <input
                type="number"
                min="500"
                step="100"
                key={
                  d.id +
                  "/" +
                  s.variant +
                  "/part2/" +
                  (layout.outroPart2Ms ?? 4000)
                }
                defaultValue={layout.outroPart2Ms ?? 4000}
                onBlur={(e) => {
                  const val = Number(e.currentTarget.value);
                  if (Number.isFinite(val) && val >= 500) {
                    override({ outroPart2Ms: Math.round(val) });
                  } else {
                    e.currentTarget.value = String(layout.outroPart2Ms ?? 4000);
                  }
                }}
              />
            </label>
            <small>
              Total outro:{" "}
              {(
                ((layout.outroPart1Ms ?? 3500) +
                  (layout.outroPart2Ms ?? 4000)) /
                1000
              ).toFixed(1)}
              s
            </small>
          </div>
        )}
        {(["hanzi", "english", "polish", "gloss"] as const)
          .filter((k) => s.variant !== "only-pinyin" || k === "hanzi")
          .map((k, i) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={layout[k]}
                onChange={(e) => override({ [k]: e.target.checked })}
              />
              {
                [
                  "Hanzi",
                  "English translation",
                  "Polish translation",
                  "Word glosses",
                ][i]
              }
            </label>
          ))}
        {(["scale", "vertical"] as const).map((k, i) => (
          <label key={k}>
            {i ? "Vertical position" : "Lyric scale"}
            <input
              type="range"
              min={i ? -40 : 0.4}
              max={i ? 40 : 1.5}
              step={i ? 1 : 0.05}
              value={layout[k]}
              onChange={(e) => override({ [k]: Number(e.target.value) })}
            />
          </label>
        ))}
      </details>
      <details>
        <summary>Master soundtrack</summary>
        <AssetPicker
          label="Alternate soundtrack"
          kind="audio"
          asset={s.soundtrack}
          onChange={(soundtrack) => save({ ...s, soundtrack })}
        />
        {s.soundtrack && (
          <button onClick={() => save({ ...s, soundtrack: undefined })}>
            Use Timing audio
          </button>
        )}
      </details>
    </>
  );
}
