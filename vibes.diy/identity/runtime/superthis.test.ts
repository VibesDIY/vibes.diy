// Bucket E Phase 4 (T4) cross-verification gate for the lifted SuperThis context.
// The full external facade contract (txt codecs, nextId, timeOrderedNextId, env
// mutation, runtimeFn) is checked against the fireproof original. Runs in node
// (identity vitest config), so this gate is local, not CI-only.
import { describe, it, expect } from "vitest";
import { ensureSuperThis as fpEnsure } from "@fireproof/core-runtime";
import { runtimeFn as fpRuntimeFn } from "@adviser/cement";
import { ensureSuperThis as exEnsure, runtimeFn as exRuntimeFn } from "./superthis.js";

const ex = exEnsure();
const fp = fpEnsure();

describe("SuperThis lift cross-verification (extracted ⇄ fireproof)", () => {
  it("txt codecs are byte-identical to fireproof (base64 / base58 / utf8) and round-trip", () => {
    for (const s of ["", "hello", "héllo-✓", "FIREProof:deviceId", "https://vibes.diy/api/app?vibe=a--b"]) {
      expect(ex.txt.base64.encode(s)).toBe(fp.txt.base64.encode(s));
      expect(ex.txt.base58.encode(s)).toBe(fp.txt.base58.encode(s));
      expect([...ex.txt.encode(s)]).toEqual([...fp.txt.encode(s)]);
      expect(ex.txt.base64.decode(ex.txt.base64.encode(s))).toBe(s);
      expect(ex.txt.base58.decode(ex.txt.base58.encode(s))).toBe(s);
    }
  });

  it("nextId: 6-byte default, str is the base58 of bin (same shape as fireproof)", () => {
    const a = ex.nextId();
    const b = fp.nextId();
    expect(a.bin.length).toBe(6);
    expect(a.bin.length).toBe(b.bin.length);
    // str is exactly base58(bin) — the same derivation fireproof uses
    expect(a.str).toBe(ex.txt.base58.encode(a.bin));
    expect(ex.nextId(10).bin.length).toBe(10);
  });

  it("timeOrderedNextId: UUIDv7-ish shape, and the time-prefix matches fireproof for a fixed clock", () => {
    const now = 1_700_000_000_000;
    const a = ex.timeOrderedNextId(now);
    const b = fp.timeOrderedNextId(now);
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(a.str).toMatch(re);
    expect(b.str).toMatch(re);
    // the first two segments are derived deterministically from `now`
    expect(a.str.slice(0, 13)).toBe(b.str.slice(0, 13));
  });

  it("env get / set / sets / delete round-trip (the full mutation surface consumers use)", () => {
    ex.env.set("BUCKET_E_T4", "x");
    expect(ex.env.get("BUCKET_E_T4")).toBe("x");
    ex.env.sets({ BUCKET_E_T4_A: "1", BUCKET_E_T4_B: "2" });
    expect(ex.env.get("BUCKET_E_T4_A")).toBe("1");
    expect(ex.env.get("BUCKET_E_T4_B")).toBe("2");
    ex.env.delete("BUCKET_E_T4");
    expect(ex.env.get("BUCKET_E_T4")).toBeFalsy();
  });

  it("runtimeFn re-export is the identical cement function", () => {
    expect(exRuntimeFn).toBe(fpRuntimeFn);
  });
});
