import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import type { Asset } from "./designs.ts";
export const AssetContext = createContext<{
  files: Map<string, File>;
  attach: (id: string, file: File) => void;
  urlFor: (file: File) => string;
}>({
  files: new Map(),
  attach: () => {},
  urlFor: () => {
    throw Error("Video media registry unavailable");
  },
});
export function useVideoFiles() {
  const [files, setFiles] = useState(new Map<string, File>());
  const urls = useRef(new Map<File, string>());
  const release = useCallback(() => {
    for (const url of urls.current.values()) URL.revokeObjectURL(url);
    urls.current.clear();
  }, []);
  useEffect(() => release, [release]);
  const urlFor = useCallback((file: File) => {
    let url = urls.current.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      urls.current.set(file, url);
    }
    return url;
  }, []);
  return useMemo(
    () => ({
      files,
      urlFor,
      attach: (id: string, file: File) =>
        setFiles((prev) => new Map(prev).set(id, file)),
      clear: () => {
        release();
        setFiles(new Map());
      },
    }),
    [files, urlFor, release],
  );
}
export function useAssetFile(asset?: Asset) {
  return useContext(AssetContext).files.get(asset?.id ?? "");
}
export function useAssetUrl(file?: File | null) {
  const { urlFor } = useContext(AssetContext);
  const [entry, setEntry] = useState<{ file: File; url: string }>();
  useEffect(() => {
    if (!file) return;
    const url = urlFor(file);
    setEntry({ file, url });
  }, [file, urlFor]);
  return entry && entry.file === file ? entry.url : undefined;
}
export function AssetPicker({
  label,
  kind,
  asset,
  onChange,
}: {
  label: string;
  kind: "image" | "video" | "audio";
  asset?: Asset;
  onChange: (a: Asset) => void;
}) {
  const { attach, files } = useContext(AssetContext);
  const generation = useRef(0);
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(
    () => () => {
      generation.current++;
    },
    [kind, asset?.id],
  );
  const [error, setError] = useState("");
  return (
    <label>
      {label}
      {asset && " · " + asset.name + (files.has(asset.id) ? "" : " (relink)")}
      <input
        type="file"
        accept={kind === "audio" ? "audio/*,video/*" : kind + "/*"}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const visit = ++generation.current;
          try {
            const next: Asset = {
              id:
                asset &&
                !files.has(asset.id) &&
                file.name === asset.name &&
                file.size === asset.size
                  ? asset.id
                  : crypto.randomUUID(),
              name: file.name,
              size: file.size,
            };
            if (kind === "image") {
              const bitmap = await createImageBitmap(file);
              bitmap.close();
            } else {
              const input = new Input({
                formats: ALL_FORMATS,
                source: new BlobSource(file),
              });
              try {
                const [video, audio] = await Promise.all([
                  input.getPrimaryVideoTrack(),
                  input.getPrimaryAudioTrack(),
                ]);
                next.hasVideo = !!video;
                next.hasAudio = !!audio;
                const track = kind === "video" ? video : audio;
                if (!track || !(await track.canDecode()))
                  throw Error(
                    "This browser cannot decode the selected track. Choose a playable file.",
                  );
                const first =
                  kind === "video"
                    ? Math.max(0, await track.getFirstTimestamp())
                    : 0;
                next.durationMs = Math.floor(
                  ((await track.computeDuration()) - first) * 1000,
                );
                if (
                  !next.durationMs ||
                  !(kind === "audio" ? next.hasAudio : next.hasVideo)
                )
                  throw Error("File lacks the required track.");
              } finally {
                input.dispose();
              }
            }
            if (visit !== generation.current) return;
            attach(next.id, file);
            latest.current(next);
            setError("");
          } catch (err) {
            if (visit === generation.current) setError(String(err));
          }
        }}
      />
      {error && <span role="alert">{error}</span>}
    </label>
  );
}
