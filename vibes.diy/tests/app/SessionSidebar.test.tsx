import React from "react";
import {
  act,
  fireEvent,
  screen,
  render,
  cleanup,
} from "@testing-library/react";
// Vitest will automatically use mocks from __mocks__ directory
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMockAuthState, setMockAuthState } from "./__mocks__/useAuth.js";
import SessionSidebar from "~/vibes.diy/app/components/SessionSidebar.js";
import { mockSessionSidebarProps } from "./mockData.js";
import { MockThemeProvider } from "./utils/MockThemeProvider.js";

// Mock AuthContext to use the mocked useAuth implementation so components don’t require an AuthProvider
vi.mock("~/vibes.diy/app/contexts/AuthContext", async () => {
  const mockAuth = await import("./__mocks__/useAuth.js");
  return {
    useAuth: mockAuth.mockUseAuth,
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Use __mocks__/useAuth helpers to manipulate auth state in tests
// (setMockAuthState / resetMockAuthState imported below)

// Mock the auth utility functions
vi.mock("~/vibes.diy/app/utils/auth.js", async () => {
  const actual = await vi.importActual("~/vibes.diy/app/utils/auth.js") as typeof import("~/vibes.diy/app/utils/auth.js");
  return {
    ...actual,
    initiateAuthFlow: vi.fn(),
  };
});

vi.mock("~/vibes.diy/app/utils/analytics", () => ({
  trackAuthClick: vi.fn(),
}));

// Create a mock for initiateLogin that we can track
const mockInitiateLogin = vi.fn().mockResolvedValue(undefined);

// Mock useAuthPopup hook
vi.mock("~/vibes.diy/app/hooks/useAuthPopup", () => ({
  useAuthPopup: () => ({
    isPolling: false,
    pollError: null,
    initiateLogin: mockInitiateLogin,
  }),
}));

// Mock VibesDIYLogo component
vi.mock("~/vibes.diy/app/components/VibesDIYLogo", () => ({
  default: ({ width, className }: { width: number; className: string }) =>
    React.createElement(
      "div",
      {
        "data-testid": "vibes-diy-logo",
        style: { width: `${width}px` },
        className,
      },
      "Logo",
    ),
  randomColorway: () => "default",
}));

// Mock colorways
vi.mock("~/vibes.diy/app/components/colorways", () => ({
  dark: { default: { diy: "#000", diyText: "#fff" } },
  light: { default: { diy: "#fff", diyText: "#000" } },
}));

// Mock icon components
vi.mock("~/vibes.diy/app/components/SessionSidebar/GearIcon", () => ({
  GearIcon: ({ className }: { className: string }) =>
    React.createElement("div", { className, "data-testid": "gear-icon" }, "⚙️"),
}));

vi.mock("~/vibes.diy/app/components/SessionSidebar/HomeIcon", () => ({
  HomeIcon: ({ className }: { className: string }) =>
    React.createElement("div", { className, "data-testid": "home-icon" }, "🏠"),
}));

vi.mock("~/vibes.diy/app/components/SessionSidebar/InfoIcon", () => ({
  InfoIcon: ({ className }: { className: string }) =>
    React.createElement("div", { className, "data-testid": "info-icon" }, "ℹ️"),
}));

vi.mock("~/vibes.diy/app/components/SessionSidebar/StarIcon", () => ({
  StarIcon: ({ className }: { className: string }) =>
    React.createElement("div", { className, "data-testid": "star-icon" }, "⭐"),
}));

vi.mock("~/vibes.diy/app/components/SessionSidebar/FirehoseIcon", () => ({
  FirehoseIcon: ({ className }: { className: string }) =>
    React.createElement(
      "div",
      { className, "data-testid": "firehose-icon" },
      "🔥",
    ),
}));

import { trackAuthClick } from "~/vibes.diy/app/utils/analytics.js";
// Import mocked functions
import { initiateAuthFlow } from "~/vibes.diy/app/utils/auth.js";

// Mock Link component from react-router-dom
vi.mock("react-router-dom", () => {
  return {
    Link: vi.fn(({ to, children, onClick, ...props }) => {
      // Use React.createElement instead of JSX
      return React.createElement(
        "a",
        {
          "data-testid": "router-link",
          href: to,
          onClick: onClick,
          ...props,
        },
        children,
      );
    }),
  };
});

// Set up createObjectURL mock so we can track calls
const createObjectURLMock = vi.fn(() => "mocked-url");
const revokeObjectURLMock = vi.fn();

// Override URL methods
Object.defineProperty(globalThis.URL, "createObjectURL", {
  value: createObjectURLMock,
  writable: true,
});

Object.defineProperty(globalThis.URL, "revokeObjectURL", {
  value: revokeObjectURLMock,
  writable: true,
});

describe("SessionSidebar component", () => {
  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    vi.clearAllMocks();
    resetMockAuthState();
    // Reset mocks
    vi.mocked(initiateAuthFlow).mockClear();
    vi.mocked(trackAuthClick).mockClear();
    mockInitiateLogin.mockClear();
    // No window event listeners needed anymore
    // Reset DOM
  });

  afterEach(() => {
    cleanup();
    globalThis.document.body.innerHTML = "";
    vi.clearAllMocks();
    vi.clearAllTimers();
    resetMockAuthState();
  });

  it("should correctly render SessionSidebar component with menu items when authenticated", () => {
    // Mock useAuth to return authenticated state
    setMockAuthState({
      isAuthenticated: true,
      isLoading: false,
    });

    const props = {
      ...mockSessionSidebarProps,
    };
    render(
      <MockThemeProvider>
        <SessionSidebar {...props} />
      </MockThemeProvider>,
    );

    // Check menu items - using queryAllByText since there might be multiple elements with the same text
    expect(screen.queryAllByText("Home").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("My Vibes").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Settings").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("About").length).toBeGreaterThan(0);

    // Should not show Log in
    expect(screen.queryByText("Log in")).toBeNull();
  });

  it("should show Log in button when not authenticated", async () => {
    // Mock useAuth to return unauthenticated state
    setMockAuthState({
      isAuthenticated: false,
      isLoading: false,
      token: null,
      userPayload: null,
    });

    const props = {
      ...mockSessionSidebarProps,
    };

    render(
      <MockThemeProvider>
        <SessionSidebar {...props} />
      </MockThemeProvider>,
    );

    // Check if the sidebar is rendered - it's the first div in the container
    const sidebar = screen.getByTestId("session-sidebar");
    expect(sidebar).toBeDefined();

    // Check for Login text
    expect(screen.queryAllByText("Log in").length).toBeGreaterThan(0);
    // There should be no Settings text
    expect(screen.queryAllByText("Settings").length).toBe(0);

    // Get the login button and click it
    const loginButton = screen.getByText("Log in");
    await act(async () => {
      fireEvent.click(loginButton);
      await Promise.resolve();
    });

    // Verify that initiateLogin was called
    expect(mockInitiateLogin).toHaveBeenCalledTimes(1);
  });

  // Test removed - needsLogin functionality no longer exists

  it("should render navigation links with correct labels", () => {
    const props = {
      ...mockSessionSidebarProps,
    };

    render(
      <MockThemeProvider>
        <SessionSidebar {...props} />
      </MockThemeProvider>,
    );

    // Check if the sidebar is rendered - it's the first div in the container
    const sidebar = screen.getByTestId("session-sidebar");
    expect(sidebar).toBeDefined();

    // Check menu items - using queryAllByText since there might be multiple elements with the same text
    expect(screen.queryAllByText("Home").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("My Vibes").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Settings").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("About").length).toBeGreaterThan(0);

    // We're not testing the href attributes because of issues with the jsdom environment
    // This is sufficient to verify that the navigation structure is correct
  });

  it("renders sidebar correctly when visible", () => {
    const onClose = vi.fn();
    const props = {
      ...mockSessionSidebarProps,
      isVisible: true,
      onClose: onClose,
    };

    render(
      <MockThemeProvider>
        <SessionSidebar {...props} />
      </MockThemeProvider>,
    );

    // Check that the menu items are rendered
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("My Vibes")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();

    // The sidebar is the first div within the container that has position fixed
    const sidebarContainer = screen.getByTestId("session-sidebar");
    expect(sidebarContainer).not.toHaveClass("-translate-x-full");
  });

  it("handles close button click", () => {
    const onClose = vi.fn();
    const props = {
      ...mockSessionSidebarProps,
      isVisible: true,
      onClose: onClose,
    };

    render(
      <MockThemeProvider>
        <SessionSidebar {...props} />
      </MockThemeProvider>,
    );

    // Find the close button (it's a button with an SVG icon, so we use aria-label)
    const closeButton = screen.getByLabelText("Close sidebar");
    expect(closeButton).toBeInTheDocument();

    // Click the close button
    fireEvent.click(closeButton);

    // Check that the onClose callback was called
    expect(onClose).toHaveBeenCalled();
  });

  it("handles sidebar navigation links", () => {
    // Mock useAuth to return authenticated state
    setMockAuthState({
      isAuthenticated: true,
      isLoading: false,
    });

    const props = {
      ...mockSessionSidebarProps,
    };

    render(
      <MockThemeProvider>
        <SessionSidebar {...props} />
      </MockThemeProvider>,
    );

    // Check if the sidebar is rendered - it's the first div in the container
    const sidebar = screen.getByTestId("session-sidebar");
    expect(sidebar).toBeDefined();

    // Check menu items - using queryAllByText since there might be multiple elements with the same text
    expect(screen.queryAllByText("Home").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("My Vibes").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Settings").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("About").length).toBeGreaterThan(0);

    // We're not testing the href attributes because of issues with the jsdom environment
    // This is sufficient to verify that the navigation structure is correct
  });

  it("closes sidebar on mobile when clicking close button", () => {
    // Mock useAuth to return authenticated state
    setMockAuthState({
      isAuthenticated: true,
      isLoading: false,
    });

    const onClose = vi.fn();
    const props = {
      ...mockSessionSidebarProps,
      isVisible: true,
      onClose: onClose,
    };

    render(
      <MockThemeProvider>
        <SessionSidebar {...props} />
      </MockThemeProvider>,
    );

    // Find the close button (it's a button with an SVG icon, so we use aria-label)
    const closeButton = screen.getByLabelText("Close sidebar");
    expect(closeButton).toBeInTheDocument();

    // Click the close button
    fireEvent.click(closeButton);

    // Check that the onClose callback was called
    expect(onClose).toHaveBeenCalled();
  });

  it("is not visible when isVisible is false", () => {
    // Mock useAuth to return authenticated state
    setMockAuthState({
      isAuthenticated: true,
      isLoading: false,
    });

    const props = {
      ...mockSessionSidebarProps,
      isVisible: false,
    };

    render(
      <MockThemeProvider>
        <SessionSidebar {...props} />
      </MockThemeProvider>,
    );

    // Find the sidebar div
    const sidebar = screen.getByTestId("session-sidebar");

    // Verify it has the -translate-x-full class for hiding
    expect(sidebar).toHaveClass("-translate-x-full");
  });

  it("has navigation items rendered correctly", () => {
    // Mock useAuth to return authenticated state
    setMockAuthState({
      isAuthenticated: true,
      isLoading: false,
    });

    const props = {
      ...mockSessionSidebarProps,
    };

    render(
      <MockThemeProvider>
        <SessionSidebar {...props} />
      </MockThemeProvider>,
    );

    // Find the navigation element
    const nav = document.querySelector("nav");
    expect(nav).toBeInTheDocument();

    // Check that it has list items
    const listItems = nav?.querySelectorAll("li");
    expect(listItems?.length).toBeGreaterThan(0);

    // Check that each list item has a link or button
    for (const li of Array.from(listItems || [])) {
      const linkOrButton = li.querySelector("a, button");
      expect(linkOrButton).toBeInTheDocument();
    }
  });

  it.skip("has navigation links that call onClose when clicked", () => {
    // Mock useAuth to return authenticated state
    setMockAuthState({
      isAuthenticated: true,
      isLoading: false,
    });

    const onClose = vi.fn();
    const props = {
      ...mockSessionSidebarProps,
      isVisible: true,
      onClose: onClose,
    };

    render(
      <MockThemeProvider>
        <SessionSidebar {...props} />
      </MockThemeProvider>,
    );

    // Test only one link to reduce complexity
    const myVibesLink = screen.getByText("My Vibes");
    fireEvent.click(myVibesLink);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
