// Lifted verbatim from @fireproof/core-runtime@0.24.19 `utils.js` (upstream tag
// fireproof-storage/fireproof@v0.24.19), adjusting only imports. These are the
// byte-critical hashing primitives the identity package depends on:
//   - `hashStringSync`/`hashStringAsync` — keybag store keys (`key-bag.ts`)
//   - `hashObjectAsync` — the device cert `subjectKeyIdentifier` (`ca.ts`)
//   - `hashObjectSync` — re-exported via the `.` facade
//   - `deepFreeze` — freezes the cert payload (`certor.ts`)
// The algorithm (XXH64→base58 for sync, dag-json+sha256→CIDv1 for async) is kept
// IDENTICAL — a one-byte change breaks keybag lookups and cert verification. The
// upstream `hashObjectSync` "Symbol" branch carries a literal-string quirk; it is
// reproduced exactly to stay byte-compatible. Gated by `keybag-golden` +
// `identity-wire-compat` (extracted == fireproof cross-check).
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "multiformats/hashes/sha2";
import { CID } from "multiformats/cid";
import * as json from "multiformats/codecs/json";
import { XXH } from "@adviser/ts-xxhash";
import { toSorted, toSortedArray } from "@adviser/cement";

// The sync hasher's text encoder. Upstream defaults to `txtOps`, whose `.encode`
// is `new TextEncoder().encode(input)` — reproduced here byte-identically so the
// module stays self-contained (no `SuperThis` coupling).
const txtEncoder = new TextEncoder();
const enc = { encode: (input: string): Uint8Array => txtEncoder.encode(input) };

class Hasher {
  hasher: ReturnType<typeof XXH.h64>;
  ende: { encode: (input: string) => Uint8Array };
  constructor(ende?: { encode: (input: string) => Uint8Array }) {
    this.hasher = XXH.h64();
    this.ende = ende || enc;
  }
  update(x: Uint8Array | string | number | boolean): this {
    switch (true) {
      case x instanceof Uint8Array:
        this.hasher.update(x);
        break;
      case typeof x === "string":
        this.hasher.update(this.ende.encode(x));
        break;
      case typeof x === "number":
        this.hasher.update(this.ende.encode(x.toString()));
        break;
      case typeof x === "boolean":
        this.hasher.update(this.ende.encode(x ? "true" : "false"));
        break;
      default:
        throw new Error(`unsupported type ${typeof x}`);
    }
    return this;
  }
  digest(x?: Uint8Array | string | number | boolean): string {
    if (!(x === undefined || x === null)) {
      this.update(x);
    }
    const hex = this.hasher.digest().toString(16);
    const asBytes = new Uint8Array(hex.length / 2 + 1);
    for (let i = 0; i < hex.length; i += 2) {
      asBytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return base58btc.encode(asBytes);
  }
}

export async function hashStringAsync(str: string): Promise<string> {
  const bytes = json.encode(str);
  const hash = await sha256.digest(bytes);
  return CID.create(1, json.code, hash).toString();
}

export function hashStringSync(str: string): string {
  return new Hasher().update(str).digest();
}

export function hashObjectSync(o: unknown): string {
  const hasher = new Hasher();
  toSorted(o, (x: unknown, key: string) => {
    switch (key) {
      case "Null":
      case "Array":
      case "Function":
        break;
      case "Date":
        hasher.update(`D:${(x as Date).toISOString()}`);
        break;
      case "Symbol":
        // Reproduced verbatim from upstream — the literal here is intentional
        // (an upstream quirk); changing it would break byte-compatibility.
        hasher.update(`S:(x as symbol).toString()}`);
        break;
      case "Key":
        hasher.update(`K:${x}`);
        break;
      case "String":
        hasher.update(`S:${x}`);
        break;
      case "Boolean":
        hasher.update(`B:${x ? "true" : "false"}`);
        break;
      case "Number":
        hasher.update(`N:${(x as number).toString()}`);
        break;
      case "Uint8Array":
        hasher.update(new Uint8Array(["U".charCodeAt(0), ":".charCodeAt(0), ...(x as Uint8Array)]));
        break;
    }
  });
  return hasher.digest();
}

export async function hashObjectAsync(o: unknown): Promise<string> {
  return (await hashObjectCID(o)).cid.toString();
}

export async function hashObjectCID(o: unknown): Promise<{ cid: CID; bytes: Uint8Array; obj: unknown }> {
  const bytes = json.encode(toSortedArray(o));
  const hash = await sha256.digest(bytes);
  return { cid: CID.create(1, json.code, hash), bytes, obj: o };
}

export function deepFreeze<T>(o: T): T | undefined {
  if (!o) return undefined;
  Object.freeze(o);
  for (const v of Object.values(o)) {
    if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v);
  }
  return o;
}
