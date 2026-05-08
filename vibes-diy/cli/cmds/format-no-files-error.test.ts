import { describe, expect, it } from "vitest";
import { formatNoFilesError } from "./format-no-files-error.js";

describe("formatNoFilesError", () => {
  const baseDiag = {
    sectionEventCount: 0,
    blockCount: 0,
    streamedBytes: 0,
    upstreamErrors: [],
    applyErrors: [],
  };

  it("silent stream — no upstream, no apply errors — exposes counts and verbose hint", () => {
    const out = formatNoFilesError({ ...baseDiag, sectionEventCount: 0, streamedBytes: 0 });
    expect(out).toContain("No files resolved from AI response.");
    expect(out).toContain("section events received: 0");
    expect(out).toContain("response bytes streamed: 0");
    expect(out).toContain("Rerun with --verbose");
    expect(out).not.toContain("apply error");
    expect(out).not.toContain("AI provider error");
  });

  it("stream had content but no files — shows non-zero counts", () => {
    const out = formatNoFilesError({
      ...baseDiag,
      sectionEventCount: 3,
      blockCount: 7,
      streamedBytes: 8421,
    });
    expect(out).toContain("section events received: 3 (7 blocks)");
    expect(out).toContain("response bytes streamed: 8421");
  });

  it("apply errors — lists up to three with reasons, summarizes the rest", () => {
    const out = formatNoFilesError({
      ...baseDiag,
      sectionEventCount: 4,
      blockCount: 4,
      streamedBytes: 1200,
      applyErrors: [
        "App.jsx: search-not-found near 'export default'",
        "edits/foo.jsx: malformed-block",
        "edits/bar.jsx: search-not-found near 'useState'",
        "edits/baz.jsx: malformed-block",
        "edits/qux.jsx: malformed-block",
      ],
    });
    expect(out).toContain("5 apply errors:");
    expect(out).toContain("App.jsx: search-not-found near 'export default'");
    expect(out).toContain("edits/foo.jsx: malformed-block");
    expect(out).toContain("edits/bar.jsx: search-not-found near 'useState'");
    expect(out).toContain("... and 2 more");
    expect(out).not.toContain("edits/baz.jsx");
    expect(out).not.toContain("edits/qux.jsx");
  });

  it("singular apply error uses singular wording", () => {
    const out = formatNoFilesError({
      ...baseDiag,
      sectionEventCount: 1,
      blockCount: 1,
      streamedBytes: 200,
      applyErrors: ["App.jsx: search-not-found"],
    });
    expect(out).toContain("1 apply error:");
    expect(out).not.toContain("1 apply errors:");
  });

  it("upstream errors switch the headline and keep diagnostics", () => {
    const out = formatNoFilesError({
      ...baseDiag,
      sectionEventCount: 1,
      blockCount: 0,
      streamedBytes: 80,
      upstreamErrors: [{ code: "context_length_exceeded", message: "prompt too long for model" }, { message: "rate limit hit" }],
    });
    expect(out).toContain("AI provider error: [context_length_exceeded] prompt too long for model; rate limit hit");
    expect(out).toContain("section events received: 1");
    expect(out).toContain("response bytes streamed: 80");
    expect(out).toContain("Rerun with --verbose");
    expect(out).not.toContain("No files resolved from AI response");
  });

  it("never emits the bare original message", () => {
    const out = formatNoFilesError(baseDiag);
    // Issue #1626 — must always include diagnostic lines, never just the headline.
    expect(out.trim().split("\n").length).toBeGreaterThan(1);
  });
});
