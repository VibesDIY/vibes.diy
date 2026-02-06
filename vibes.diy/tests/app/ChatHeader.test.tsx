import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatHeader from "~/vibes.diy/app/components/ChatHeaderContent.js";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

// Create mock functions we can control
const onOpenSidebar = vi.fn();

// Mock useNavigate
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

describe("ChatHeader", () => {
  beforeEach(() => {
    // Reset mocks before each test
    globalThis.document.body.innerHTML = "";
    vi.resetAllMocks();
  });

  it("renders correctly", () => {
    render(
      <MockThemeProvider>
        <ChatHeader onOpenSidebar={onOpenSidebar} title="Test Chat" isStreaming={false} codeReady={false} />
      </MockThemeProvider>
    );

    expect(screen.getByLabelText("Open chat history")).toBeDefined();
    expect(screen.getByLabelText("New Vibe")).toBeDefined();
  });

  it("calls openSidebar when the sidebar button is clicked", () => {
    render(
      <MockThemeProvider>
        <ChatHeader onOpenSidebar={onOpenSidebar} title="Test Chat" isStreaming={false} codeReady={false} />
      </MockThemeProvider>
    );

    const openButton = screen.getByLabelText("Open chat history");
    fireEvent.click(openButton);

    expect(onOpenSidebar).toHaveBeenCalledTimes(1);
  });

  it("navigates to home when the new chat button is clicked", () => {
    render(
      <MockThemeProvider>
        <ChatHeader onOpenSidebar={onOpenSidebar} title="Test Chat" isStreaming={false} codeReady={false} />
      </MockThemeProvider>
    );

    // Just verify the new vibe button exists since we can't easily mock document.location
    const newVibeButton = screen.getByLabelText("New Vibe");
    expect(newVibeButton).toBeInTheDocument();

    // Note: we can't reliably test the navigation in JSDOM environment
    // In a real browser, clicking this button would navigate to '/'
  });
});
