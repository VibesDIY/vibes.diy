// Owned `SuperThis` runtime-context closure (#2937 — drop the last
// `@fireproof/core-types-base` TYPE imports from the identity package).
//
// Reproduced verbatim (erasable interfaces only) from `core-types-base`'s
// `types.d.ts` @ 0.24.19 (upstream tag fireproof-storage/fireproof@v0.24.19):
// the `SuperThis` context + its `txt`/`pathOps`/`crypto`/`env` primitives that
// thread through the whole device-id / keybag crypto. These are pure types —
// erased at build — so owning them here changes no runtime behavior; the runtime
// `ensureSuperThis()` lift already lives in `../runtime/superthis.ts`.
//
// `SuperThis` is now centralized here (the issue's "centralize their ownership,
// likely in identity"): every in-repo module imports the context type from this
// module, and the `.` / `./node` barrels re-export it for downstream consumers
// (api, cli) so nothing imports `SuperThis` from `@fireproof/core-types-*`.
import type { Env, Logger, CryptoRuntime, AppContext, EnvFactoryOpts, Result } from "@adviser/cement";

export type ToUInt8 = Uint8Array | Result<Uint8Array>;
export type PromiseToUInt8 = ToUInt8 | Promise<Uint8Array> | Promise<Result<Uint8Array>>;

export interface FPStats {
  isFile(): boolean;
  isDirectory(): boolean;
  isBlockDevice(): boolean;
  isCharacterDevice(): boolean;
  isSymbolicLink(): boolean;
  isFIFO(): boolean;
  isSocket(): boolean;
  uid: number | Falsy;
  gid: number | Falsy;
  size: number | Falsy;
  atime: Date | Falsy;
  mtime: Date | Falsy;
  ctime: Date | Falsy;
  birthtime: Date | Falsy;
}

export type Falsy = false | null | undefined;

export interface SysFileSystem {
  start(): Promise<SysFileSystem>;
  mkdir(path: string, options?: { recursive: boolean }): Promise<string | undefined>;
  readdir(path: string): Promise<string[]>;
  rm(path: string, options?: { recursive: boolean }): Promise<void>;
  copyFile(source: string, destination: string): Promise<void>;
  readfile(path: string): Promise<Uint8Array>;
  stat(path: string): Promise<FPStats>;
  unlink(path: string): Promise<void>;
  writefile(path: string, data: Uint8Array | string): Promise<void>;
}

export interface PathOps {
  join(...args: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
}

export interface BaseXXEndeCoder {
  encode(input: string | ToUInt8): string;
  decodeUint8(input: string): Uint8Array;
  decode(input: string): string;
}

export interface TextEndeCoder {
  id(): string;
  encode(input: string): Uint8Array;
  decode(input: ToUInt8): string;
  readonly base64: BaseXXEndeCoder;
  readonly base58: BaseXXEndeCoder;
}

export interface TextEndeCodable {
  txt: TextEndeCoder;
}

export interface SuperThisOpts {
  readonly logger: Logger;
  readonly pathOps: PathOps;
  readonly crypto: CryptoRuntime;
  readonly env: Partial<EnvFactoryOpts>;
  readonly txt: TextEndeCoder;
  readonly ctx: AppContext;
}

export interface SuperThis {
  readonly logger: Logger;
  readonly loggerCollector?: Logger;
  readonly env: Env;
  readonly pathOps: PathOps;
  readonly ctx: AppContext;
  readonly txt: TextEndeCoder;
  timeOrderedNextId(time?: number): { str: string; toString: () => string };
  nextId(bytes?: number): { str: string; bin: Uint8Array; toString: () => string };
  start(): Promise<void>;
  clone(override: Partial<SuperThisOpts>): SuperThis;
}

// `DocTypes` is the open document shape the (browser-safe) wire types reference.
export type DocObject = NonNullable<unknown>;
export type DocTypes = DocObject;
