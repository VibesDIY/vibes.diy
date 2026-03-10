import type { LoginPlatform } from "./login.js";

export const denoLoginPlatform: LoginPlatform = {
  serve(opts, handler) {
    const server = Deno.serve(
      { port: opts.port, hostname: opts.hostname, signal: opts.signal,
        onListen: () => { /* suppress default log */ } },
      handler,
    );
    return { close() { server.shutdown(); }, finished: server.finished };
  },
  async openBrowser(url) {
    const cmd = new Deno.Command("open", { args: [url] });
    await cmd.output();
  },
  getEnv(key) {
    return Deno.env.get(key);
  },
};
