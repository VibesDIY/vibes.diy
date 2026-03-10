import { createServer, type Server } from "node:http";
import { execFile } from "node:child_process";
import { env, platform } from "node:process";
import type { LoginPlatform } from "./login.js";

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

export const nodeLoginPlatform: LoginPlatform = {
  serve(opts, handler) {
    let finishedResolve: () => void;
    const finished = new Promise<void>((r) => {
      finishedResolve = r;
    });
    const server = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", `http://${opts.hostname}:${opts.port}`);
      const request = new Request(url.toString(), { method: req.method });
      try {
        const response = await handler(request);
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        const body = await response.text();
        res.end(body);
      } catch (err) {
        res.writeHead(500);
        res.end(err instanceof Error ? err.message : "Internal error");
      }
    });
    server.on("error", () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assigned synchronously in Promise constructor
      finishedResolve!();
    });
    opts.signal.addEventListener("abort", () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assigned synchronously in Promise constructor
      server.close(() => finishedResolve!());
    });
    server.listen(opts.port, opts.hostname);
    return {
      close() {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assigned synchronously in Promise constructor
        closeServer(server).then(finishedResolve!, finishedResolve!);
      },
      finished,
    };
  },
  async openBrowser(url) {
    const cmd = platform === "win32" ? "cmd" : platform === "darwin" ? "open" : "xdg-open";
    const args = platform === "win32" ? ["/c", "start", "", url] : [url];
    await new Promise<void>((resolve, reject) => {
      execFile(cmd, args, (err) => (err ? reject(err) : resolve()));
    });
  },
  getEnv(key) {
    return env[key];
  },
};
