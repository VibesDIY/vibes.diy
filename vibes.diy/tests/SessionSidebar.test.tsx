import React from "react";
import { act, fireEvent, screen, render } from "@testing-library/react";
// Vitest will automatically use mocks from __mocks__ directory
import { beforeEach, describe, expect, it, vi } from "vitest";
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

// Mock navigation - SessionSidebar now uses navigate() instead of popup auth

vi.mock("~/vibes.diy/app/utils/analytics", () => ({
  trackAuthClick: vi.fn(),
}));

import { trackAuthClick } from "~/vibes.diy/app/utils/analytics.js";

// Create mock navigate function
const mockNavigate = vi.fn();

// Mock react-router-dom components
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
    useNavigate: () => mockNavigate,
  };
});

// Set up createObjectURL mock so we can track calls
const createObjectURLMock = vi.fn(() => "mocked-url");
const revokeObjectURLMock = vi.fn();

// Override URL methods
Object.defineProperty(global.URL, "createObjectURL", {
  value: createObjectURLMock,
  writable: true,
});

Object.defineProperty(global.URL, "revokeObjectURL", {
  value: revokeObjectURLMock,
  writable: true,
});

describe("SessionSidebar component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockAuthState();
    // Reset mocks
    mockNavigate.mockClear();
    vi.mocked(trackAuthClick).mockClear();
    // Reset DOM
    document.body.innerHTML = "";
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

    // Verify that navigate and trackAuthClick were called
    expect(mockNavigate).toHaveBeenCalledWith("/login");
    expect(trackAuthClick).toHaveBeenCalledWith({
      label: "Sidebar Login",
      isUserAuthenticated: false,
    });
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

  it("has navigation links that call onClose when clicked", () => {
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

    // Find all navigation links
    const navLinks = screen.getAllByText(/My Vibes|Settings|About/);

    // Click each link and verify onClose is called
    for (const link of navLinks) {
      fireEvent.click(link);
      expect(onClose).toHaveBeenCalled();
      onClose.mockClear();
    }
  });
});
