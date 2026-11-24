import { cueTime } from "../import/edition-cues";
import { StudioHandoff } from "./StudioHandoff.tsx";
import { VideoDownload } from "./VideoDownload.tsx";
import {
  Project,
  Snapshot,
  conflictingLyrics,
  exportIssues,
  serializeProject,
} from "../domain";
import { exportLegacy } from "../legacy";
import { AssetContext, useVideoFiles } from "../video/video-assets.tsx";

const creditLabels: Record<string, string> = {
  url: "Source link",
  channel_url: "Channel link",
  fetchedAt: "Retrieved",
  id: "Source ID",
  duration: "Duration (seconds)",
  upload_date: "Upload date",
  fingerprint: "Recording SHA-256",
};
export function ExportWorkspace({
  project,
  videoFiles,
  projectAudio,
  change,
  setVideoTab,
  navigate,
  download,
  allowDraft,
  setAllowDraft,
  act,
}: {
  project: Project;
  videoFiles: ReturnType<typeof useVideoFiles>;
  projectAudio: File | null;
  change: (
    p: Project,
    selection?: Partial<Snapshot>,
    preserveOrder?: boolean,
  ) => void;
  setVideoTab: (tab: "Video" | "Thumbnail") => void;
  navigate: (value: string) => void;
  download: (filename: string, text: string) => void;
  allowDraft: boolean;
  setAllowDraft: (allow: boolean) => void;
  act: (fn: () => void) => void;
}) {
  const warnings = project ? exportIssues(project) : [];
  return (
    <div className="two">
      <AssetContext.Provider value={videoFiles}>
        <div>
          <VideoDownload project={project} file={projectAudio} />
          <StudioHandoff
            save={(videoSettings) =>
              change({ ...project, videoSettings }, {}, true)
            }
            openVideo={(tab) => {
              setVideoTab(tab);
              navigate("Video settings");
            }}
            project={project}
            file={projectAudio}
            download={download}
          />
        </div>
      </AssetContext.Provider>
      <section>
        <h2>Review & compatibility</h2>
        {conflictingLyrics(project).length > 0 && (
          <p role="alert">
            Resolve conflicting duplicate lyrics before TypeScript export:{" "}
            {conflictingLyrics(project).join(", ")}
          </p>
        )}
        <p>
          {project.phrases.length} phrases · {project.occurrences.length}{" "}
          ordered occurrences
        </p>
        <ul className="warnings">
          {warnings.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        {warnings.length > 0 && (
          <label className="check">
            <input
              type="checkbox"
              checked={allowDraft}
              onChange={(e) => setAllowDraft(e.target.checked)}
            />
            I have read the warnings. Export an incomplete draft preserving my
            data.
          </label>
        )}
        <button
          className="primary"
          disabled={
            conflictingLyrics(project).length > 0 ||
            (warnings.length > 0 && !allowDraft)
          }
          onClick={() => act(() => download("Song.ts", exportLegacy(project)))}
        >
          Download legacy TypeScript
        </button>
        <p>
          Manually place the downloaded module in src/ and reference it in the
          existing composition. Nothing is overwritten automatically. Unassigned
          timing exports as explicit zero placeholders.
        </p>
        <button
          onClick={() =>
            download("song.workbench.json", serializeProject(project, 2))
          }
        >
          Download project JSON
        </button>
      </section>
      <section>
        <h2>Sources &amp; credits</h2>
        {Object.entries({
          Song: project.metadata,
          Recording: project.recordingSource,
          Lyrics: project.lyricsSource,
        }).map(
          ([label, values]) =>
            values && (
              <div key={label}>
                <h3>{label}</h3>
                <dl>
                  {Object.entries(values).map(([key, value]) => (
                    <div key={key}>
                      <dt>
                        {creditLabels[key] ??
                          key[0]?.toUpperCase() + key.slice(1)}
                      </dt>
                      <dd>
                        {typeof value === "string" &&
                        /^https?:\/\//i.test(value) ? (
                          <a href={value} target="_blank" rel="noreferrer">
                            {value}
                          </a>
                        ) : (
                          String(value)
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ),
        )}
        {project.editionTiming && (
          <details>
            <summary>LRCLIB cues ({project.editionTiming.cues.length})</summary>
            <p>
              Edition {project.editionTiming.editionId} · Recording SHA-256{" "}
              {project.editionTiming.fingerprint}
            </p>
            {project.editionTiming.credits?.map((c) => (
              <div key={c.id}>
                <a href={c.url}>
                  {c.track} · {c.artist} · LRCLIB {c.id}
                </a>{" "}
                · {c.album} · {c.duration}s · {c.fetchedAt}
                {!!c.cues?.length && (
                  <details>
                    <summary>Original edition timestamps</summary>
                    <pre>
                      {c.cues
                        .map((c) => cueTime(c.startMs) + " " + c.text)
                        .join("\n")}
                    </pre>
                  </details>
                )}
              </div>
            ))}
            {project.editionTiming.credits && (
              <ul>
                {project.editionTiming.pieces.map((p) => (
                  <li key={p.id}>
                    {p.text} · lyrics {p.sourceId}{" "}
                    {p.timingSourceId && "· timing " + p.timingSourceId}
                  </li>
                ))}
              </ul>
            )}
            <pre>
              {project.editionTiming.cues
                .map((c) => cueTime(c.startMs) + " " + c.text)
                .join("\n")}
            </pre>
          </details>
        )}
      </section>
      <section>
        <h2>Legacy song output</h2>
        <pre>
          {conflictingLyrics(project).length
            ? "Resolve duplicate lyric conflicts to preview TypeScript."
            : exportLegacy(project)}
        </pre>
      </section>
    </div>
  );
}
