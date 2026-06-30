import { createCliStream } from "./create-cli-stream.js";

export interface CliCtx {
  cliStream: ReturnType<typeof createCliStream>;
}
