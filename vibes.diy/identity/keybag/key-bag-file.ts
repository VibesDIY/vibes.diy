// Lifted verbatim from @fireproof/core-gateways-file@0.24.19 `key-bag-file.js`
// (upstream tag fireproof-storage/fireproof@v0.24.19). The file-backed keybag
// provider: writes `<dir>/<id>.json` as `JSON.stringify(item, null, 2)`, reads it
// back through `JSON.parse`, and throws "read bag failed" on a corrupt/unparseable
// file (returns undefined only for a missing file). Imports only adjusted; the
// on-disk format + error behavior are byte-identical (gated by the keybag golden
// harness). `isNotFoundError` is lifted verbatim from `core-types-base/types.js`.
import { Result } from "@adviser/cement";
import type { URI } from "@adviser/cement";
import type { SuperThis } from "../types/sthis.js";
import { sysFileSystemFactory } from "./sys-file-system/factory.js";

function isNotFoundError(e: unknown): boolean {
  let err: unknown = e;
  if (Result.Is(err)) {
    if (err.isOk()) return false;
    err = err.Err();
  }
  return (err as { code?: string } | null | undefined)?.code === "ENOENT";
}

export class KeyBagProviderFile {
  readonly url: URI;
  readonly logger: SuperThis["logger"];
  readonly sthis: SuperThis;
  constructor(url: URI, sthis: SuperThis) {
    this.url = url;
    this.sthis = sthis;
    this.logger = sthis.logger;
  }
  async #prepare(id: string) {
    await this.sthis.start();
    const sysFS = await sysFileSystemFactory(this.url);
    const dirName = this.url.pathname;
    await sysFS.mkdir(dirName, { recursive: true });
    return {
      dirName,
      sysFS,
      fName: this.sthis.pathOps.join(dirName, `${id.replace(/[^a-zA-Z0-9]/g, "_")}.json`),
    };
  }
  async del(id: string): Promise<void> {
    const ctx = await this.#prepare(id);
    try {
      await ctx.sysFS.unlink(ctx.fName);
    } catch (e) {
      if (isNotFoundError(e)) {
        return;
      }
      throw this.logger.Error().Err(e).Any("file", ctx).Msg("delete bag failed").AsError();
    }
  }
  async get(id: string): Promise<unknown> {
    const ctx = await this.#prepare(id);
    try {
      const p = await ctx.sysFS.readfile(ctx.fName);
      const ki = JSON.parse(this.sthis.txt.decode(p));
      return ki;
    } catch (e) {
      if (isNotFoundError(e)) {
        return undefined;
      }
      throw this.logger.Error().Err(e).Any("file", ctx).Msg("read bag failed").AsError();
    }
  }
  async set(id: string, item: unknown): Promise<void> {
    const ctx = await this.#prepare(id);
    const p = this.sthis.txt.encode(JSON.stringify(item, null, 2));
    await ctx.sysFS.writefile(ctx.fName, p);
  }
}
