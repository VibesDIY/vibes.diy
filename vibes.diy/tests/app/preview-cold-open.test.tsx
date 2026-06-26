import { describe, expect, it } from "vitest";
import { shouldShowColdOpen } from "../../pkg/app/components/ResultPreview/PreviewApp.js";

// shouldShowColdOpen is a pure function of three state values.
// Extracted from PreviewApp so it can be unit-tested without mounting
// the full component (which requires useParams, useVibesDiy, etc.).
describe("PreviewApp cold open", () => {
  it("shows the themed skeleton while generating with nothing painted yet", () => {
    const result = shouldShowColdOpen({ running: true, pinnedFsId: undefined, firstStreamDone: false });
    expect(result).toBe(true);
  });

  it("hides the themed skeleton once the app has painted", () => {
    const result = shouldShowColdOpen({ running: false, pinnedFsId: "fs-123", firstStreamDone: true });
    expect(result).toBe(false);
  });
});
