import React from "react";
import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ThemedSkeleton } from "../../pkg/app/components/ResultPreview/ThemedSkeleton.js";

// Explicit cleanup between tests — required under isolate:false (no auto-cleanup).
afterEach(cleanup);

describe("ThemedSkeleton", () => {
  it("applies theme tokens as CSS variables on the root", () => {
    const { container } = render(
      <ThemedSkeleton colorTheme={{ background: "#101014", accent: "#cfa562", "text-primary": "#fafafa" }} />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--skeleton-bg")).toBe("#101014");
    expect(root.style.getPropertyValue("--skeleton-accent")).toBe("#cfa562");
  });

  it("renders an app-shell placeholder (header + cards + button) with a neutral fallback", () => {
    const { getByTestId } = render(<ThemedSkeleton colorTheme={null} />);
    expect(getByTestId("themed-skeleton-header")).toBeTruthy();
    expect(getByTestId("themed-skeleton-card-0")).toBeTruthy();
    expect(getByTestId("themed-skeleton-card-1")).toBeTruthy();
    expect(getByTestId("themed-skeleton-cta")).toBeTruthy();
  });
});
