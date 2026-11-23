import { useEffect, useState } from "react";
import { sourceVideoFps } from "../export/export-media.ts";

export function useSourceFps(file?: File | null) {
  const [result, setResult] = useState<{ file: File; fps?: number }>();
  useEffect(() => {
    if (!file) return;
    let active = true;
    void sourceVideoFps(file).then(
      (fps) => {
        if (active) setResult({ file, fps });
      },
      () => {
        if (active) setResult({ file });
      },
    );
    return () => {
      active = false;
    };
  }, [file]);
  return result?.file === file ? result : undefined;
}
