import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { VibeContainer } from "~/vibes.diy/app/routes/vibe-container.js";
import { BuildURI } from "@adviser/cement";

// Mock window.location.replace to prevent navigation errors
// const mockReplace = vi.fn();
// Object.defineProperty(window, "location", {
//   value: {
//     replace: mockReplace,
//     search: "",
//   },
//   writable: true,
// });

// Mock the useParams hook to return a vibeSlug
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => {
      console.log("useNavigate called");
      return vi.fn();
    },
    useParams: () => ({ vibeSlug: "sound-panda-9086" }),
  };
});

// const  mockReplace = vi
//     .spyOn(window.location, "replace")
//     // .mockImplementation(() => {
//     //   console.log("Mock replace called");
//     // });

// const origReplace = () => globalThis.window.location
// globalThis.window.location = {
//   ...globalThis.window.location,
//   replace: vi.fn().mockImplementation(() => {
//     console.log("Mock replace called");
//     origReplace()
//   }),
// }
// .replace = vi.fn().mockImplementation(() => {
//   console.log(">>>>>>>")
//   origReplace()
// })

describe("Vibe Route", () => {
  const mockReplace = vi.fn();
  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    mockReplace.mockClear();
  });

  it("redirects to the correct vibe subdomain URL", () => {
    render(
      <MemoryRouter initialEntries={["/vibe/sound-panda-9086"]}>
        <Routes>
          <Route
            path="/vibe/:vibeSlug"
            element={<VibeContainer replace={mockReplace} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    // Check that it shows redirecting message
    expect(screen.getByText("Redirecting...")).toBeInTheDocument();

    // Check that window.location.replace was called with correct URL
    expect(
      BuildURI.from(mockReplace.mock.calls[0][0]).cleanParams().toString(),
    ).toBe("https://sound-panda-9086.vibesdiy.app/");
  });

  it("redirects without showing header content", () => {
    render(
      <MemoryRouter initialEntries={["/vibe/sound-panda-9086"]}>
        <Routes>
          <Route
            path="/vibe/:vibeSlug"
            element={<VibeContainer replace={mockReplace} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    // Check that it shows redirecting message
    expect(screen.getByText("Redirecting...")).toBeInTheDocument();

    // Check that there's no header or formatted title
    expect(screen.queryByText("Sound Panda 9086")).not.toBeInTheDocument();
    expect(screen.queryByText("Remix")).not.toBeInTheDocument();

    // Ensure redirect was called
    expect(
      BuildURI.from(mockReplace.mock.calls[0][0]).cleanParams().toString(),
    ).toBe("https://sound-panda-9086.vibesdiy.app/");
  });
});
