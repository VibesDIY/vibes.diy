// Lifted verbatim from @fireproof/core-gateways-file-deno@0.24.19
// `deno-filesystem.js` (upstream tag fireproof-storage/fireproof@v0.24.19). The
// Deno-runtime filesystem wrapper, preserved because deno anchors cross-runtime
// correctness (it is exercised under the deno runtime, just not via the CLI's
// node path). Imports only adjusted; behavior byte-identical.
//
// `Deno` is the deno global (typed via the `@types/deno` devDependency); this
// module only runs under deno, where the global exists natively.
import { Lazy, to_uint8 } from "@adviser/cement";
import type { SysFileSystem } from "../../types/sthis.js";

export class DenoFileSystem implements SysFileSystem {
  fs = Lazy(() => {
    return Deno;
  });
  async start(): Promise<SysFileSystem> {
    return this;
  }
  async mkdir(path: string, options?: { recursive: boolean }): Promise<string | undefined> {
    return this.fs()
      .mkdir(path, options)
      .then(() => path);
  }
  async readdir(path: string): Promise<string[]> {
    const ret = [];
    for await (const dirEntry of this.fs().readDir(path)) {
      ret.push(dirEntry.name);
    }
    return ret;
  }
  async rm(path: string, options?: { recursive: boolean }): Promise<void> {
    return this.fs().remove(path, options);
  }
  async copyFile(source: string, destination: string): Promise<void> {
    return this.fs().copyFile(source, destination);
  }
  async readfile(path: string): Promise<Uint8Array> {
    const ret = await this.fs().readFile(path);
    return ret;
  }
  async stat(path: string): Promise<import("fs").Stats> {
    const x = await this.fs().stat(path);
    return {
      isFile: () => x.isFile,
      isDirectory: () => x.isDirectory,
      isBlockDevice: () => !!x.isBlockDevice,
      isCharacterDevice: () => !!x.isCharDevice,
      isSymbolicLink: () => x.isSymlink,
      isFIFO: () => !!x.isFifo,
      isSocket: () => !!x.isSocket,
      uid: x.uid,
      gid: x.gid,
      size: x.size,
      atime: x.atime,
      mtime: x.mtime,
      ctime: x.birthtime,
      birthtime: x.birthtime,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }
  async unlink(path: string): Promise<void> {
    return this.fs().remove(path);
  }
  async writefile(path: string, data: Uint8Array | string): Promise<void> {
    const toUint8 = to_uint8(data);
    return this.fs().writeFile(path, toUint8);
  }
}
