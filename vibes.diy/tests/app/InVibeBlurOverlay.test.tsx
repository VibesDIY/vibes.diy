import * as React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { InVibeBlurOverlay } from "~/vibes.diy/app/components/InVibeBlurOverlay.js";

describe("InVibeBlurOverlay", () => {
  afterEach(() => cleanup());

  it("renders nothing when inactive", () => {
    const { queryByTestId } = render(<InVibeBlurOverlay active={false} blurPx={25} />);
    expect(queryByTestId("in-vibe-blur-overlay")).toBeNull();
  });

  it("applies backdrop blur at the given blurPx when active", () => {
    const { getByTestId } = render(<InVibeBlurOverlay active blurPx={25} />);
    const el = getByTestId("in-vibe-blur-overlay");
    expect(el.style.backdropFilter).toContain("blur(25");
  });

  it("falls back to moving-stripes when the blur has decayed below 0.01", () => {
    const { getByTestId } = render(<InVibeBlurOverlay active blurPx={0} />);
    const el = getByTestId("in-vibe-blur-overlay");
    expect(el.style.backdropFilter).toBe("");
    expect(el.style.animation).toContain("moving-stripes");
  });
});
