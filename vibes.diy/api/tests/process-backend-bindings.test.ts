import { describe, it, expect } from "vitest";
import { extractBackendExports } from "../svc/intern/process-backend-bindings.js";

describe("extractBackendExports", () => {
  it("detects onChange export", () => {
    const source = `export async function onChange(event, ctx) { }`;
    const result = extractBackendExports(source);
    expect(result.hasOnChange).toBe(true);
    expect(result.hasFetch).toBe(false);
    expect(result.hasScheduled).toBe(false);
  });

  it("detects fetch export", () => {
    const source = `export async function fetch(request, ctx) { }`;
    const result = extractBackendExports(source);
    expect(result.hasFetch).toBe(true);
  });

  it("detects scheduled export with config", () => {
    const source = `
export const config = { scheduled: { interval: "5m" } };
export async function scheduled(event, ctx) { }`;
    const result = extractBackendExports(source);
    expect(result.hasScheduled).toBe(true);
    expect(result.scheduledInterval).toBe("5m");
  });

  it("detects all three exports", () => {
    const source = `
export async function fetch(request, ctx) { }
export async function scheduled(event, ctx) { }
export async function onChange(event, ctx) { }
export const config = { scheduled: { interval: "30s" } };`;
    const result = extractBackendExports(source);
    expect(result.hasOnChange).toBe(true);
    expect(result.hasFetch).toBe(true);
    expect(result.hasScheduled).toBe(true);
    expect(result.scheduledInterval).toBe("30s");
  });

  it("returns all false for empty file", () => {
    const result = extractBackendExports("");
    expect(result.hasOnChange).toBe(false);
    expect(result.hasFetch).toBe(false);
    expect(result.hasScheduled).toBe(false);
  });

  it("detects non-async exports", () => {
    const source = `export function onChange(event, ctx) { }`;
    const result = extractBackendExports(source);
    expect(result.hasOnChange).toBe(true);
  });
});
