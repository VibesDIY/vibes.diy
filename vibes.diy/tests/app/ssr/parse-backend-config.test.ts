// Slice B2 (#2856): push-time parsing of backend.js — trigger-export detection +
// config.scheduled.interval validation (reject sub-5s / >1h). Pure, node env.

import { describe, it, expect } from "vitest";
import { parseBackendConfig, MIN_INTERVAL_MS, MAX_INTERVAL_MS } from "../../../vibe/runtime/parse-backend-config.js";

describe("parseBackendConfig — handler detection", () => {
  it("detects all three trigger exports (async function form)", () => {
    const r = parseBackendConfig(`
      export async function fetch(req, ctx) {}
      export async function scheduled(evt, ctx) {}
      export async function onChange(evt, ctx) {}
      export const config = { scheduled: { interval: "5m" } };
    `);
    expect(r.handlers).toEqual(["fetch", "scheduled", "onChange"]);
    expect(r.hasConfig).toBe(true);
  });

  it("detects const-arrow and plain function exports", () => {
    const r = parseBackendConfig(`
      export const fetch = async (req, ctx) => new Response("ok");
      export function onChange(evt, ctx) {}
    `);
    expect(r.handlers).toEqual(["fetch", "onChange"]);
  });

  it("detects exports declared in an export list, incl. aliases", () => {
    const r = parseBackendConfig(`
      async function handleHttp(req, ctx) {}
      function react(evt, ctx) {}
      export { handleHttp as fetch, react as onChange };
    `);
    expect(r.handlers).toEqual(["fetch", "onChange"]);
  });

  it("returns nothing for an empty / undefined / backend-less file", () => {
    expect(parseBackendConfig(undefined).handlers).toEqual([]);
    expect(parseBackendConfig("").handlers).toEqual([]);
    expect(parseBackendConfig("export const x = 1;").handlers).toEqual([]);
  });

  it("does not mistake a substring (e.g. prefetch) for the fetch export", () => {
    const r = parseBackendConfig(`export function prefetchThing() {}`);
    expect(r.handlers).toEqual([]);
  });
});

describe("parseBackendConfig — interval validation", () => {
  const withInterval = (raw: string) =>
    parseBackendConfig(`
      export async function scheduled(evt, ctx) {}
      export const config = { scheduled: { interval: "${raw}" } };
    `);

  it("accepts the documented interval units and parses them to ms", () => {
    expect(withInterval("5s").schedule).toEqual({ intervalMs: 5_000, raw: "5s" });
    expect(withInterval("30s").schedule?.intervalMs).toBe(30_000);
    expect(withInterval("1m").schedule?.intervalMs).toBe(60_000);
    expect(withInterval("5m").schedule?.intervalMs).toBe(300_000);
    expect(withInterval("15m").schedule?.intervalMs).toBe(900_000);
    expect(withInterval("1h").schedule?.intervalMs).toBe(3_600_000);
  });

  it("accepts the inclusive boundaries (5s, 1h)", () => {
    expect(withInterval("5s").errors).toEqual([]);
    expect(withInterval("1h").errors).toEqual([]);
    expect(withInterval("5s").schedule?.intervalMs).toBe(MIN_INTERVAL_MS);
    expect(withInterval("1h").schedule?.intervalMs).toBe(MAX_INTERVAL_MS);
  });

  it("rejects sub-5s intervals with no schedule produced", () => {
    const r = withInterval("1s");
    expect(r.schedule).toBeUndefined();
    expect(r.errors.join(" ")).toMatch(/faster than the 5s minimum/);
  });

  it("rejects over-1h intervals", () => {
    expect(withInterval("2h").errors.join(" ")).toMatch(/slower than the 1h maximum/);
    expect(withInterval("61m").errors.join(" ")).toMatch(/slower than the 1h maximum/);
  });

  it("rejects a malformed interval", () => {
    expect(withInterval("soon").errors.join(" ")).toMatch(/not a valid duration/);
  });

  it("errors when a scheduled handler has no interval", () => {
    const r = parseBackendConfig(`export async function scheduled(evt, ctx) {}`);
    expect(r.handlers).toEqual(["scheduled"]);
    expect(r.schedule).toBeUndefined();
    expect(r.errors.join(" ")).toMatch(/requires a config\.scheduled\.interval/);
  });

  it("ignores an interval when there is no scheduled handler (not an error)", () => {
    const r = parseBackendConfig(`
      export async function fetch(req, ctx) {}
      export const config = { scheduled: { interval: "1s" } };
    `);
    expect(r.errors).toEqual([]);
    expect(r.schedule).toBeUndefined();
  });

  it("ignores a stray interval: key outside the scheduled block", () => {
    const r = parseBackendConfig(`
      export async function scheduled(evt, ctx) {}
      export const config = { scheduled: { interval: "5m" }, ui: { interval: "1s" } };
    `);
    expect(r.schedule?.raw).toBe("5m");
    expect(r.errors).toEqual([]);
  });

  // Codex P2: interval extraction must anchor to the EXPORTED config object, not the
  // first `scheduled: { interval }` anywhere in the source.
  it("ignores a scheduled block in a non-config object declared before config", () => {
    const r = parseBackendConfig(`
      const defaults = { scheduled: { interval: "1s" } };
      export async function scheduled(evt, ctx) {}
      export const config = { scheduled: { interval: "5m" } };
    `);
    expect(r.errors).toEqual([]);
    expect(r.schedule?.raw).toBe("5m");
  });

  it("does not register a schedule from a non-config object when there is no config export", () => {
    const r = parseBackendConfig(`
      const sample = { scheduled: { interval: "30s" } };
      export async function scheduled(evt, ctx) {}
    `);
    expect(r.hasConfig).toBe(false);
    expect(r.schedule).toBeUndefined();
    expect(r.errors.join(" ")).toMatch(/requires a config\.scheduled\.interval/);
  });

  it("handles a config object with nested braces / sibling objects before scheduled", () => {
    const r = parseBackendConfig(`
      export async function scheduled(evt, ctx) {}
      export const config = { meta: { tags: ["a", "b"] }, scheduled: { interval: "15m" } };
    `);
    expect(r.schedule?.intervalMs).toBe(900_000);
    expect(r.errors).toEqual([]);
  });
});
