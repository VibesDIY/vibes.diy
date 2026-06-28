// Lifted verbatim from @fireproof/core-gateways-file-node@0.24.19
// `node-filesystem.js` (upstream tag fireproof-storage/fireproof@v0.24.19). A
// thin wrapper over `node:fs/promises`. Imports only adjusted; behavior
// byte-identical (same dynamic `import("fs/promises")` indirection, same
// `toArrayBuffer` on read).
import type { SysFileSystem } from "@fireproof/core-types-base";
import { toArrayBuffer } from "./to-array-buffer.js";

type FsPromises = typeof import("node:fs/promises");

export class NodeFileSystem implements SysFileSystem {
  fs?: FsPromises;
  async start(): Promise<SysFileSystem> {
    const fs = "fs/promises";
    this.fs = (await import(fs)) as FsPromises;
    return this;
  }
  async mkdir(path: string, options?: { recursive: boolean }): Promise<string | undefined> {
    return this.fs?.mkdir(path, options);
  }
  async readdir(path: string, options?: unknown): Promise<string[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.fs?.readdir(path, options as any) as Promise<string[]>;
  }
  async rm(path: string, options?: { recursive: boolean }): Promise<void> {
    return this.fs?.rm(path, options);
  }
  async copyFile(source: string, destination: string): Promise<void> {
    return this.fs?.copyFile(source, destination);
  }
  async readfile(path: string, options?: { encoding: BufferEncoding; flag?: string }): Promise<Uint8Array> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ret = (await this.fs?.readFile(path, options as any)) as Buffer;
    return toArrayBuffer(ret);
  }
  stat(path: string): Promise<import("fs").Stats> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.fs!.stat(path);
  }
  async unlink(path: string): Promise<void> {
    return this.fs?.unlink(path);
  }
  async writefile(path: string, data: Uint8Array | string): Promise<void> {
    return this.fs?.writeFile(path, data);
  }
}
