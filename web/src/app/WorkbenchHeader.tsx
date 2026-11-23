import { useEffect, useRef } from "react";
import { version } from "../../../package.json";
import { needsImportSplit } from "../timing/automatic-timing";
import { History, Project, redo, serializeProject, undo } from "../domain";
import { timingStatus } from "../timing/timing.ts";
import type { EditorHistory } from "../useEditorHistory";

export function WorkbenchHeader({
  screen,
  project,
  importProgress,
  suggestionProgress,
  translationProgress,
  timingProgress,
  saved,
  openWorkspace,
  importing,
  editingStructure,
  editorHistory,
  history,
  setHistory,
  setDialog,
  download,
}: {
  screen: string;
  project: Project | undefined;
  importProgress: string;
  suggestionProgress: string;
  translationProgress: string;
  timingProgress: string;
  saved: string;
  openWorkspace: (name: string) => void;
  importing: boolean;
  editingStructure: boolean;
  editorHistory: EditorHistory | null;
  history: History | null;
  setHistory: React.Dispatch<React.SetStateAction<History | null>>;
  setDialog: (kind: null) => void;
  download: (filename: string, text: string) => void;
}) {
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const measure = () =>
      header.parentElement?.style.setProperty(
        "--workbench-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  const workspaces = [
    ["Import lyrics", "Import"],
    ["Lyric editor", "Translations"],
    ["Timing", "Timing"],
    ["Video settings", "Video"],
    ["Export data", "Export"],
  ];
  const activeWorkspace =
    screen === "Song structure" ? "Import lyrics" : screen;
  const counts: Record<string, string> = project
    ? {
        "Lyric editor":
          project.phrases.filter((p) => p.review === "reviewed").length +
          "/" +
          project.phrases.length,
        Timing:
          project.occurrences.filter(
            (o) => timingStatus(o, project.audio?.durationMs) === "Reviewed",
          ).length +
          "/" +
          project.occurrences.length,
      }
    : {};
  const projectName = project
    ? [project.metadata.title || "Untitled song", project.metadata.artist]
        .filter(Boolean)
        .join(" · ")
    : "Lyric Workbench";
  const pendingImportSplits =
    project?.timingRun?.candidates.some(needsImportSplit);
  const jobs: Record<string, string> = {
    "Import lyrics":
      importProgress || suggestionProgress || (pendingImportSplits ? "!" : ""),
    "Lyric editor":
      translationProgress ||
      (project?.translationWork?.drafts.length ? "!" : ""),
    Timing:
      timingProgress ||
      (project?.timingRun &&
      (project.timingRun.candidates.some((c) => !needsImportSplit(c)) ||
        project.occurrences.some(
          (o) =>
            (o.automaticTiming || o.timingIssue) &&
            o.timingReview !== "reviewed",
        ))
        ? "!"
        : ""),
  };

  return (
    <header ref={headerRef}>
      <div className="project-identity">
        <span className="music-mark" aria-hidden="true">
          ♫
        </span>
        <strong>Lyric Workbench</strong>
        <small title={[projectName, saved].join(" · ")}>
          v{version}
          {project && " · " + projectName} {saved && " · " + saved}
        </small>
      </div>
      <nav className="workflow-tabs" aria-label="Workspaces">
        {workspaces.map(([name, label], index) => (
          <button
            key={name}
            data-workspace={name}
            aria-current={activeWorkspace === name ? "page" : undefined}
            onClick={() => openWorkspace(name)}
          >
            <span
              className="step-marker"
              data-complete={name === "Import lyrics" && !!project}
              aria-hidden="true"
            >
              {name === "Import lyrics" && project ? "✓" : index + 1}
            </span>
            {label}{" "}
            {jobs[name] && (
              <b
                aria-label={jobs[name] === "!" ? "Needs attention" : jobs[name]}
              >
                {jobs[name]}
              </b>
            )}
            {counts[name] && <small> {counts[name]}</small>}
          </button>
        ))}
      </nav>
      <label className="workspace-picker">
        Workspace
        <select
          value={activeWorkspace}
          onChange={(e) => openWorkspace(e.target.value)}
        >
          {workspaces.map(([name, label]) => (
            <option value={name} key={name}>
              {jobs[name]}
              {label} {counts[name]}
            </option>
          ))}
        </select>
      </label>
      <span className="mobile-job" role="status">
        {workspaces
          .filter(([name]) => jobs[name])
          .map(([name, label]) => label + " " + jobs[name])
          .join(" · ")}
      </span>
      <div className="actions">
        <button
          disabled={
            importing ||
            editingStructure ||
            (editorHistory ? !editorHistory.undo : !history?.past.length)
          }
          onClick={() => {
            if (editorHistory) {
              editorHistory.undo?.();
              return;
            }
            setHistory((h) => (h ? undo(h) : h));
            setDialog(null);
          }}
        >
          Undo
        </button>
        <button
          disabled={
            importing ||
            editingStructure ||
            (editorHistory ? !editorHistory.redo : !history?.future.length)
          }
          onClick={() => {
            if (editorHistory) {
              editorHistory.redo?.();
              return;
            }
            setHistory((h) => (h ? redo(h) : h));
            setDialog(null);
          }}
        >
          Redo
        </button>
        <button
          disabled={!project}
          onClick={() =>
            project &&
            download("song.workbench.json", serializeProject(project, 2))
          }
        >
          Download project JSON
        </button>
      </div>
    </header>
  );
}
