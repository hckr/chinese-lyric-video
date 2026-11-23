import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { Project } from "../domain.ts";
import type { Snap } from "./timing.ts";
type Settings = NonNullable<Project["timingSettings"]>;
export function TimingSettings({
  active,
  settings,
  zoomTo,
  updateSettings,
  children,
}: {
  active: boolean;
  settings: Settings;
  zoomTo: (value: Settings["zoom"]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  children: ReactNode;
}) {
  const { zoom, snap, linkEdges } = settings;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPosition, setSettingsPosition] = useState<{
    left: number;
    top: number;
  }>();
  const settingsDialog = useRef<HTMLDivElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const closeSettings = (restoreFocus: boolean) => {
    setSettingsOpen(false);
    if (restoreFocus) settingsTrigger.current?.focus({ preventScroll: true });
  };
  useLayoutEffect(() => {
    if (!settingsOpen || !active) return;
    const panel = settingsDialog.current!,
      trigger = settingsTrigger.current!;
    const position = () => {
      const anchor = trigger.getBoundingClientRect();
      const { width, height } = panel.getBoundingClientRect();
      const above = anchor.top - height - 8,
        right = anchor.right + 8;
      const headerBottom =
        document.querySelector("main > header")?.getBoundingClientRect()
          .bottom ?? 0;
      if (above >= headerBottom + 8 && anchor.top <= innerHeight)
        setSettingsPosition({
          top: above,
          left: Math.max(
            8,
            Math.min(anchor.right - width, innerWidth - width - 8),
          ),
        });
      else if (
        right + width + 8 <= innerWidth &&
        anchor.bottom >= 0 &&
        anchor.top < innerHeight
      )
        setSettingsPosition({
          top: Math.max(
            headerBottom + 8,
            Math.min(anchor.top, innerHeight - height - 8),
          ),
          left: right,
        });
      else
        setSettingsPosition({
          top: Math.max(
            headerBottom + 8,
            Math.min(anchor.bottom + 8, innerHeight - height - 8),
          ),
          left: Math.max(
            8,
            Math.min(anchor.right - width, innerWidth - width - 8),
          ),
        });
    };
    position();
    panel.querySelector("select")?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (
        !panel.contains(event.target as Node) &&
        !trigger.contains(event.target as Node)
      )
        setSettingsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector("dialog[open]"))
        return;
      event.preventDefault();
      setSettingsOpen(false);
      trigger.focus({ preventScroll: true });
    };
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [settingsOpen, active]);
  useEffect(() => {
    if (!active) setSettingsOpen(false);
  }, [active]);
  return (
    <>
      <div className="timing-toolbar-actions">
        {children}{" "}
        <button
          ref={settingsTrigger}
          className="timing-settings-trigger"
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          aria-controls="timing-settings-panel"
          onClick={() => {
            setSettingsPosition(undefined);
            setSettingsOpen(!settingsOpen);
          }}
        >
          <span className="timing-settings-label">
            <span aria-hidden="true">⚙</span> Timing settings
          </span>
          <span className="timing-settings-summary">
            {zoom}× · {snap === "edges" ? "Edge snap" : "Snap off"} ·{" "}
            {linkEdges ? "Edges linked" : "Edges unlinked"}
          </span>
        </button>
      </div>
      <div
        hidden={!settingsOpen}
        ref={settingsDialog}
        role={settingsOpen ? "dialog" : undefined}
        id="timing-settings-panel"
        className="timing-settings"
        aria-labelledby="timing-settings-title"
        style={
          settingsPosition
            ? { position: "fixed", ...settingsPosition }
            : { position: "fixed", top: 0 }
        }
      >
        <h2 id="timing-settings-title">Timing settings</h2>
        <label>
          Zoom
          <select
            aria-label="Timeline zoom"
            value={zoom}
            onChange={(e) =>
              zoomTo(Number(e.target.value) as typeof settings.zoom)
            }
          >
            {[1, 2, 4, 8, 16, 32].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <label>
          Snap
          <select
            aria-label="Timing snap"
            value={snap}
            onChange={(e) => updateSettings({ snap: e.target.value as Snap })}
          >
            <option value="off">Off</option>
            <option value="edges">Neighboring edges</option>
          </select>
        </label>
        <label className="check">
          Link touching edges
          <input
            type="checkbox"
            checked={linkEdges}
            onChange={(e) => updateSettings({ linkEdges: e.target.checked })}
          />
        </label>
        <label>
          Before lyric (ms)
          <input
            type="number"
            min={0}
            max={5000}
            value={settings.preRollMs}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 0 && n <= 5000)
                updateSettings({ preRollMs: n });
            }}
          />
        </label>
        <label>
          After lyric (ms)
          <input
            type="number"
            min={0}
            max={5000}
            value={settings.postRollMs}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 0 && n <= 5000)
                updateSettings({ postRollMs: n });
            }}
          />
        </label>
        <label className="check">
          Auto-advance after review
          <input
            type="checkbox"
            checked={settings.autoAdvance}
            onChange={(e) => updateSettings({ autoAdvance: e.target.checked })}
          />
        </label>
        <button onClick={() => closeSettings(true)}>Done</button>
      </div>
    </>
  );
}
