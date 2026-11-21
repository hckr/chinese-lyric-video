import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

export async function translateLyrics(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  revise: boolean,
) {
  const headers = {
    "Content-Type": "application/x-ndjson",
    "Cache-Control": "no-store",
  };
  const error = (status: number, message: string) => {
    if (res.destroyed || res.writableEnded) return;
    if (!res.headersSent) res.writeHead(status, headers);
    res.end(JSON.stringify({ kind: "error", message }) + "\n");
  };
  if (
    req.method !== "POST" ||
    (req.headers.origin &&
      req.headers.origin !== `http://${req.headers.host}`) ||
    req.headers["content-type"]?.split(";")[0] !== "application/json"
  ) {
    error(403, "Translation requires a same-origin JSON POST.");
    return;
  }
  let child: ReturnType<typeof spawn> | undefined;
  const abort = () => child?.kill("SIGTERM");
  res.once("close", abort);
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 5_000_000) {
        error(413, "Translation request exceeds 5 MB.");
        return;
      }
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Boolean(body.revision) !== revise
    ) {
      error(400, "Invalid translation request.");
      return;
    }
    if (res.destroyed) return;
    child = spawn(
      process.env.WORKBENCH_PYTHON ||
        path.join(root, "python-src/venv/bin/python"),
      ["-u", "-m", "workbench.react_translation"],
      { cwd: path.join(root, "python-src"), stdio: ["pipe", "pipe", "ignore"] },
    );
    res.writeHead(200, headers);
    res.flushHeaders();
    child.stdout!.pipe(res, { end: false });
    child.stdin!.on("error", () => {});
    child.stdin!.end(JSON.stringify(body));
    const code = await new Promise<number | null>((resolve, reject) => {
      child!.once("error", reject);
      child!.once("close", resolve);
    });
    if (code !== 0)
      error(
        500,
        "Translation worker stopped. Check the local Python environment.",
      );
    else if (!res.destroyed) res.end();
  } catch {
    error(
      child ? 500 : 400,
      child
        ? "Unable to start translation worker."
        : "Invalid translation request.",
    );
  } finally {
    res.off("close", abort);
  }
}
