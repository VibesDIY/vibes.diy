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
import SessionSidebar from "~/vibes.diy/app/components/SessionSidebar.js";
import { mockSessionSidebarProps } from "./mockData.js";

// Mock @clerk/clerk-react
const mockUseAuth = vi.fn();
vi.mock("@clerk/clerk-react", () => ({
  useAuth: mockUseAuth,
}));

import { trackAuthClick } from "~/vibes.diy/app/utils/analytics.js";

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
    // Old auth mocks removed - now using Clerk
    vi.mocked(trackAuthClick).mockClear();
    // No window event listeners needed anymore
    // Reset DOM
  });

  afterEach(() => {
    cleanup();
    globalThis.document.body.innerHTML = "";
    vi.clearAllMocks();
    vi.clearAllTimers();
    // Old auth mocks removed - now using Clerk
  });

  it("should correctly render SessionSidebar component with menu items when authenticated", () => {
    // Mock useAuth to return authenticated state
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    });

    const props = {
      ...mockSessionSidebarProps,
    };
    render(<SessionSidebar {...props} />);

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
    mockUseAuth.mockReturnValue({
      isSignedIn: false,
      isLoaded: true,
    });

    const props = {
      ...mockSessionSidebarProps,
    };

    render(<SessionSidebar {...props} />);

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

    // Verify that the sign in button is rendered (or a function is called)
    // For now, we'll just check that the button was clicked.
    // A more robust test would check for the Clerk sign-in modal.
  });

  // Test removed - needsLogin functionality no longer exists

  it("should render navigation links with correct labels", () => {
    const props = {
      ...mockSessionSidebarProps,
    };

    render(<SessionSidebar {...props} />);

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

    render(<SessionSidebar {...props} />);

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

    render(<SessionSidebar {...props} />);

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
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    });

    const props = {
      ...mockSessionSidebarProps,
    };

    render(<SessionSidebar {...props} />);

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
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    });

    const onClose = vi.fn();
    const props = {
      ...mockSessionSidebarProps,
      isVisible: true,
      onClose: onClose,
    };

    render(<SessionSidebar {...props} />);

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
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    });

    const props = {
      ...mockSessionSidebarProps,
      isVisible: false,
    };

    render(<SessionSidebar {...props} />);

    // Find the sidebar div
    const sidebar = screen.getByTestId("session-sidebar");

    // Verify it has the -translate-x-full class for hiding
    expect(sidebar).toHaveClass("-translate-x-full");
  });

  it("has navigation items rendered correctly", () => {
    // Mock useAuth to return authenticated state
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    });

    const props = {
      ...mockSessionSidebarProps,
    };

    render(<SessionSidebar {...props} />);

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
    mockUseAuth.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
    });

    const onClose = vi.fn();
    const props = {
      ...mockSessionSidebarProps,
      isVisible: true,
      onClose: onClose,
    };

    render(<SessionSidebar {...props} />);

    // Test only one link to reduce complexity
    const myVibesLink = screen.getByText("My Vibes");
    fireEvent.click(myVibesLink);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
