// Bucket E byte-compat gate for the lifted SuperThis context. T2–T4 proved the
// in-repo impl byte-identical to @fireproof/core-runtime via live cross-checks;
// T5 froze those reference values into ../golden-fixtures.ts and dropped the live
// dep, so this now asserts extracted == frozen contract (runs in node).
import { describe, it, expect } from "vitest";
import { runtimeFn as cementRuntimeFn } from "@adviser/cement";
import { ensureSuperThis as exEnsure, runtimeFn as exRuntimeFn } from "./superthis.js";
import { TXT_BASE64, TXT_BASE58, TXT_ENCODE_UTF8, TIME_ORDERED_PREFIX } from "../golden-fixtures.js";

const ex = exEnsure();

describe("SuperThis lift — byte-compat against the frozen fireproof contract", () => {
  it("txt codecs match the frozen fireproof outputs (base64 / base58 / utf8) and round-trip", () => {
    for (const s of Object.keys(TXT_BASE64)) {
      expect(ex.txt.base64.encode(s)).toBe(TXT_BASE64[s]);
      expect(ex.txt.base58.encode(s)).toBe(TXT_BASE58[s]);
      expect(ex.txt.base64.decode(ex.txt.base64.encode(s))).toBe(s);
      expect(ex.txt.base58.decode(ex.txt.base58.encode(s))).toBe(s);
    }
    // Direct raw-UTF-8 byte contract (Charlie #2858) — not hidden behind a codec
    // round-trip: a non-UTF-8 encode regression must fail here.
    for (const s of Object.keys(TXT_ENCODE_UTF8)) {
      expect([...ex.txt.encode(s)]).toEqual(TXT_ENCODE_UTF8[s]);
    }
  });

  it("nextId: 6-byte default, str is the base58 of bin", () => {
    const a = ex.nextId();
    expect(a.bin.length).toBe(6);
    expect(a.str).toBe(ex.txt.base58.encode(a.bin));
    expect(ex.nextId(10).bin.length).toBe(10);
  });

  it("timeOrderedNextId: UUIDv7-ish shape + frozen time-prefix for a fixed clock", () => {
    const a = ex.timeOrderedNextId(1_700_000_000_000);
    expect(a.str).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(a.str.slice(0, 13)).toBe(TIME_ORDERED_PREFIX);
  });

  it("timeOrderedNextId: the variant nibble is always 'b' (the bin[1] transform; Codex #2854)", () => {
    for (let i = 0; i < 256; i++) {
      expect(ex.timeOrderedNextId(1_700_000_000_000 + i).str.split("-")[3][0]).toBe("b");
    }
  });

  it("env get / set / sets / delete round-trip (the full mutation surface consumers use)", () => {
    ex.env.set("BUCKET_E_T5", "x");
    expect(ex.env.get("BUCKET_E_T5")).toBe("x");
    ex.env.sets({ BUCKET_E_T5_A: "1", BUCKET_E_T5_B: "2" });
    expect(ex.env.get("BUCKET_E_T5_A")).toBe("1");
    expect(ex.env.get("BUCKET_E_T5_B")).toBe("2");
    ex.env.delete("BUCKET_E_T5");
    expect(ex.env.get("BUCKET_E_T5")).toBeFalsy();
  });

  it("runtimeFn re-export is the identical cement function", () => {
    expect(exRuntimeFn).toBe(cementRuntimeFn);
  });
});
