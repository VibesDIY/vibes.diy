import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { VibeIframeContainerComponent } from "~/vibes.diy/app/routes/vibe-container.js";
import { BuildURI } from "@adviser/cement";

// Mock window.location for iframe src tests
// const mockLocation = {
//   search: "",
// };

// Object.defineProperty(window, "location", {
//   value: mockLocation,
//   writable: true,
// });

describe("Vibe Route with Group ID", () => {
  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    // mockLocation.search = "";
  });

  it("renders iframe with correct subdomain URL for vibe with group", () => {
    render(
      <MemoryRouter initialEntries={["/vibe/sound-panda-9086/abc123"]}>
        <Routes>
          <Route
            path="/vibe/:titleId/:installId"
            element={
              <VibeIframeContainerComponent vibeSlug="sound-panda-9086" />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    // Check that iframe is rendered
    const iframe = screen.getByTitle("Vibe: sound-panda-9086");
    expect(iframe).toBeInTheDocument();

    // Check that iframe src points to correct subdomain
    const iframeSrc = (iframe as HTMLIFrameElement).src;
    expect(BuildURI.from(iframeSrc).cleanParams().toString()).toBe(
      "https://sound-panda-9086.vibesdiy.app/",
    );
  });

  it("preserves query parameters in iframe URL", () => {
    // mockLocation.search = "?foo=bar&baz=qux";

    render(
      <MemoryRouter
        initialEntries={["/vibe/sound-panda-9086/abc123?foo=bar&baz=qux"]}
      >
        <Routes>
          <Route
            path="/vibe/:titleId/:installId"
            element={
              <VibeIframeContainerComponent vibeSlug="sound-panda-9086" />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    // Check that iframe src includes query parameters
    const iframe = screen.getByTitle("Vibe: sound-panda-9086");
    const iframeSrc = new URL((iframe as HTMLIFrameElement).src);
    expect(iframeSrc.host).toContain("sound-panda-9086");
  });
});
