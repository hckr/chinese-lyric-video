import type { VerifiedSplitAudio } from "./AutomaticTiming";
import { DocumentImport } from "./DocumentImport";
import { ImportAudioSplits } from "./ImportAudioSplits";
import { ProjectStructure } from "./ProjectStructure";
import { TimingConfirmDialog } from "./TimingConfirmDialog";
import { Project, Snapshot, serializeProject } from "./domain";
import type { LyricField } from "./lyric-field.ts";
import type { EditorHistory } from "./useEditorHistory";

export function ImportWorkspace({
  project,
  screen,
  pendingImportSplits,
  projectAudio,
  splitAudio,
  change,
  replaceTrigger,
  download,
  setReplaceTrigger,
  lyricsInput,
  importDisabled,
  setEditorHistory,
  projectSession,
  documentSource,
  importLocked,
  setSuggestionProgress,
  setImportProgress,
  runImport,
  read,
  snapshot,
  navigate,
  replaceProject,
}: {
  project: Project | undefined;
  screen: string;
  pendingImportSplits: boolean | undefined;
  projectAudio: File | null;
  splitAudio: VerifiedSplitAudio | undefined;
  change: (
    p: Project,
    selection?: Partial<Snapshot>,
    preserveOrder?: boolean,
  ) => void;
  replaceTrigger: HTMLButtonElement | null;
  download: (filename: string, text: string) => void;
  setReplaceTrigger: (trigger: HTMLButtonElement | null) => void;
  lyricsInput: React.RefObject<LyricField | null>;
  importDisabled: boolean;
  setEditorHistory: (h: EditorHistory | null) => void;
  projectSession: number;
  documentSource: { text: string };
  importLocked: boolean;
  setSuggestionProgress: (value: string) => void;
  setImportProgress: (value: string) => void;
  runImport: (
    load: () => Promise<Project | string>,
    audio?: File | null,
  ) => Promise<void>;
  read: (file: File) => void;
  snapshot: Snapshot | undefined;
  navigate: (value: string) => void;
  replaceProject: () => void;
}) {
  return (
    <>
      {" "}
      {(!project || screen === "Import lyrics") && (
        <div hidden={screen !== "Import lyrics"}>
          {project && pendingImportSplits && (
            <ImportAudioSplits
              project={project}
              file={projectAudio}
              verifiedAudio={splitAudio}
              active
              apply={(p) => change(p, {}, true)}
            />
          )}
          {replaceTrigger && (
            <TimingConfirmDialog
              cancelLabel="Keep project"
              extraAction={
                project && (
                  <button
                    onClick={() =>
                      download(
                        "song.workbench.json",
                        serializeProject(project, 2),
                      )
                    }
                  >
                    Download project JSON
                  </button>
                )
              }
              title="Replace current project?"
              action="Discard project and start import"
              trigger={replaceTrigger}
              onCancel={() => setReplaceTrigger(null)}
              onConfirm={replaceProject}
            >
              Starting a new import will discard this project and its undo
              history.{" "}
            </TimingConfirmDialog>
          )}
          {!project && (
            <fieldset disabled={importDisabled} className="import-fields">
              <DocumentImport
                publishHistory={setEditorHistory}
                key={projectSession}
                source={documentSource}
                editor={lyricsInput}
                active={screen === "Import lyrics"}
                locked={importLocked}
                reportAI={setSuggestionProgress}
                reportAudio={setImportProgress}
                runImport={runImport}
              />
              <section>
                <h2>Open a saved project or legacy song</h2>
                <p>
                  Open project JSON or a legacy TypeScript song. Choose a .txt
                  file to fill the lyrics field.
                </p>
                <label className="file">
                  Choose .ts, .txt or project .json
                  <input
                    type="file"
                    accept=".ts,.txt,.json"
                    aria-label="Song file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void read(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </section>
            </fieldset>
          )}
        </div>
      )}
      {project &&
        (screen === "Song structure" || screen === "Import lyrics") && (
          <ProjectStructure
            publishHistory={setEditorHistory}
            project={project}
            selectedId={snapshot?.occurrenceId}
            cancel={() => navigate("Timing")}
            apply={(p) => {
              change(p, {}, true);
              navigate("Timing");
            }}
          />
        )}
      {project && screen === "Import lyrics" && (
        <div className="import-replacement">
          <button onClick={(e) => setReplaceTrigger(e.currentTarget)}>
            Import another song…
          </button>
        </div>
      )}
    </>
  );
}
