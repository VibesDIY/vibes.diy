import { createCliStream } from "./create-cli-stream.js";
import { SuperThisLike } from "./super-this.js";

export interface CliCtx {
  sthis: SuperThisLike;
  cliStream: ReturnType<typeof createCliStream>;
}
