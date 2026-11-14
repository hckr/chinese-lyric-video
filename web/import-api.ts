import { spawn } from "node:child_process";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

export async function importLyrics(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  mode: "import" | "dictionary" = "import",
) {
  res.setHeader("Content-Type", "application/json");
  const fail = (status: number, error: string) => {
    if (!res.writableEnded && !res.destroyed)
      res.writeHead(status).end(JSON.stringify({ error }));
  };
  if (req.method !== "POST") {
    fail(405, "Use POST for local lyric import.");
    return;
  }
  // Reject cross-origin browser requests; this endpoint never needs remote access.
  if (
    req.headers.origin &&
    req.headers.origin !== `http://${req.headers.host}`
  ) {
    fail(403, "Local requests only.");
    return;
  }
  req.setEncoding("utf8");
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString();
    if (Buffer.byteLength(body) > 5_000_000) {
      fail(413, "Import limit is 5 MB.");
      return;
    }
  }
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    fail(400, "Invalid import request.");
    return;
  }
  const python =
    process.env.WORKBENCH_PYTHON ||
    path.join(
      root,
      "python-src/venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    );
  const child = spawn(
    python,
    [
      "-m",
      mode === "dictionary"
        ? "workbench.react_dictionary"
        : "workbench.react_ingest",
    ],
    {
      cwd: path.join(root, "python-src"),
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const timer = setTimeout(() => {
    child.kill();
    fail(504, "Dictionary import timed out. Existing project retained.");
  }, 30000);
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  res.once("close", () => {
    if (!res.writableEnded) child.kill();
  });
  let output = "",
    errors = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
    if (output.length > 10_000_000) {
      child.kill();
      fail(413, "Dictionary draft too large.");
    }
  });
  child.stderr.on("data", (chunk) => {
    errors = (errors + chunk.toString()).slice(-4000);
  });
  child.stdin.on("error", () => {});
  child.on("error", () => {
    clearTimeout(timer);
    fail(
      503,
      "Python backend unavailable. Install python-src/requirements.txt in python-src/venv, then restart the workbench.",
    );
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    if (res.writableEnded) return;
    if (code) {
      fail(
        400,
        errors.trim().split("\n").at(-1) || "Dictionary import failed.",
      );
      return;
    }
    try {
      const project = JSON.parse(output);
      res.end(JSON.stringify(project));
    } catch {
      fail(502, "Python returned an invalid dictionary draft.");
    }
  });
  child.stdin.end(JSON.stringify(data));
}
