import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import VibespaceComponent from "~/vibes.diy/app/components/VibespaceComponent.js";

// Mock the Fireproof hook
vi.mock("use-fireproof", () => ({
  useFireproof: vi.fn(() => ({
    useAllDocs: vi.fn(() => ({ docs: [] })),
  })),
  toCloud: vi.fn().mockReturnValue({}),
}));

// Mock the vibespace theme components
vi.mock("~/vibes.diy/app/components/vibespace/Basic", () => ({
  default: ({ userId }: { userId: string }) => (
    <div data-testid="basic-theme">Basic theme for {userId}</div>
  ),
}));

vi.mock("~/vibes.diy/app/components/vibespace/Wild", () => ({
  default: ({ userId }: { userId: string }) => (
    <div data-testid="wild-theme">Wild theme for {userId}</div>
  ),
}));

vi.mock("~/vibes.diy/app/components/vibespace/ExplodingBrain", () => ({
  default: ({ userId }: { userId: string }) => (
    <div data-testid="brain-theme">Brain theme for {userId}</div>
  ),
}));

vi.mock("~/vibes.diy/app/components/vibespace/Cyberpunk", () => ({
  default: ({ userId }: { userId: string }) => (
    <div data-testid="cyberpunk-theme">Cyberpunk theme for {userId}</div>
  ),
}));

// Mock Canvas API for jsdom
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value: vi.fn(() => ({
    fillStyle: "",
    fillRect: vi.fn(),
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "",
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    shadowBlur: 0,
    shadowColor: "",
  })),
});

// Mock VibesDIYLogo
vi.mock("~/vibes.diy/app/components/VibesDIYLogo", () => ({
  default: ({ height }: { height: number }) => (
    <div data-testid="vibes-logo" style={{ height: `${height}px` }}>
      Vibes DIY Logo
    </div>
  ),
}));

// Mock SimpleAppLayout
vi.mock("~/vibes.diy/app/components/SimpleAppLayout", () => ({
  default: ({
    children,
    headerLeft,
  }: {
    children: React.ReactNode;
    headerLeft: React.ReactNode;
  }) => (
    <div>
      <header>{headerLeft}</header>
      <main>{children}</main>
    </div>
  ),
}));

const renderWithRouter = (
  component: React.ReactElement,
  initialEntries = ["/"],
) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>{component}</MemoryRouter>,
  );
};

describe("VibespaceComponent", () => {
  it("should render starfield for user with no vibes (tildeId)", () => {
    renderWithRouter(<VibespaceComponent tildeId="nonexistentuser" />);

    expect(screen.getByText("EMPTY SPACE")).toBeInTheDocument();
    expect(screen.getByText("~nonexistentuser")).toBeInTheDocument();
    expect(screen.getByText("GO TO /VIBES/MINE")).toBeInTheDocument();
    expect(screen.getByText(/STAR ANY PUBLISHED VIBE ON/i)).toBeInTheDocument();
    expect(screen.getByText("/VIBES/MINE")).toBeInTheDocument();
    expect(screen.getByText(/TO LIST IT HERE/i)).toBeInTheDocument();
  });

  it("should render starfield for user with no vibes (atId)", () => {
    renderWithRouter(<VibespaceComponent atId="nonexistentuser" />);

    expect(screen.getByText("EMPTY SPACE")).toBeInTheDocument();
    expect(screen.getByText("@nonexistentuser")).toBeInTheDocument();
    expect(screen.getByText("GO TO /VIBES/MINE")).toBeInTheDocument();
    expect(screen.getByText(/STAR ANY PUBLISHED VIBE ON/i)).toBeInTheDocument();
    expect(screen.getByText("/VIBES/MINE")).toBeInTheDocument();
    expect(screen.getByText(/TO LIST IT HERE/i)).toBeInTheDocument();
  });

  it("should render invalid user space message when no ID provided", () => {
    renderWithRouter(<VibespaceComponent />);

    expect(screen.getByText("Invalid user space")).toBeInTheDocument();
  });

  it("should accept clean user IDs without prefix symbols", () => {
    // Test that the component receives clean IDs (no ~ or @ prefix)
    renderWithRouter(<VibespaceComponent tildeId="z2KBppKuUFKYxQvuj9" />);

    // Should show the clean ID with the appropriate prefix in the starfield
    expect(screen.getByText("~z2KBppKuUFKYxQvuj9")).toBeInTheDocument();
    expect(screen.getByText("EMPTY SPACE")).toBeInTheDocument();
  });

  it("should handle @ prefix correctly", () => {
    renderWithRouter(<VibespaceComponent atId="someuser123" />);

    // Should show the clean ID with @ prefix
    expect(screen.getByText("@someuser123")).toBeInTheDocument();
    expect(screen.getByText("EMPTY SPACE")).toBeInTheDocument();
  });

  it("should render canvas element for starfield animation", () => {
    const { container } = renderWithRouter(
      <VibespaceComponent tildeId="testuser" />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveClass("absolute", "inset-0", "h-full", "w-full");
  });

  it("should have starfield animation styles", () => {
    renderWithRouter(<VibespaceComponent tildeId="testuser" />);

    // Check that starfield container has the right classes
    const starfieldContainer = screen
      .getByText("EMPTY SPACE")
      .closest(".h-screen");
    expect(starfieldContainer).toHaveClass("bg-black");
  });
});
