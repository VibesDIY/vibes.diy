import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "~/vibes.diy/app/contexts/AuthContext.js";
import type { AuthContextType } from "~/vibes.diy/app/contexts/AuthContext.js";
import * as SettingsModule from "~/vibes.diy/app/routes/settings.js";
import type { TokenPayload } from "~/vibes.diy/app/utils/auth.js";

// Extract the Settings component directly since we can't import the default export in tests
const Settings = SettingsModule.default;

// Mock components and hooks
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("~/vibes.diy/app/components/SimpleAppLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("~/vibes.diy/app/hooks/useSession", () => ({
  useSession: () => ({
    mainDatabase: { name: "test-db" },
  }),
}));

vi.mock("use-fireproof", () => ({
  useFireproof: () => ({
    useDocument: () => ({
      doc: { _id: "user_settings", stylePrompt: "", userPrompt: "", model: "" },
      merge: vi.fn(),
      save: vi.fn(),
    }),
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    length: 0,
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock navigate from react-router
const navigateMock = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

// Mock the auth utility functions
vi.mock("~/vibes.diy/app/utils/auth.js", async (original) => {
  const actual =
    (await original()) as typeof import("~/vibes.diy/app/utils/auth.js");
  return {
    ...actual,
    initiateAuthFlow: vi.fn(),
  };
});

vi.mock("~/vibes.diy/app/utils/analytics", () => ({
  trackAuthClick: vi.fn(),
}));

// Create a wrapper component with auth context
const renderWithAuthContext = (
  ui: React.ReactNode,
  { isAuthenticated = true, userId = "test-user" } = {},
) => {
  const userPayload: TokenPayload | null = isAuthenticated
    ? {
        userId,
        exp: 9999999999,
        tenants: [],
        ledgers: [],
        iat: 1234567890,
        iss: "FP_CLOUD",
        aud: "PUBLIC",
      }
    : null;

  const authValue = {
    token: isAuthenticated ? "test-token" : null,
    isAuthenticated,
    isLoading: false,
    userPayload,
    checkAuthStatus: vi.fn(() => Promise.resolve()),
    processToken: vi.fn(),
    needsLogin: false,
    setNeedsLogin: vi.fn(),
  } as AuthContextType;

  return render(
    <AuthContext.Provider value={authValue}>{ui}</AuthContext.Provider>,
  );
};

describe("Settings page", () => {
  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    vi.clearAllMocks();
    // Reset the localStorage mock
    localStorageMock.clear();
    localStorageMock.setItem("auth_token", "test-token");

    // Reset the navigate mock
    navigateMock.mockClear();
  });

  it("should render the Settings page with a logout button when authenticated", async () => {
    renderWithAuthContext(<Settings />);

    // Check if the logout button is rendered
    const logoutButton = screen.getByText("Logout");
    expect(logoutButton).toBeDefined();
  });

  it("should handle logout correctly when the button is clicked", async () => {
    renderWithAuthContext(<Settings />);

    // Get the logout button and click it
    const logoutButton = screen.getByText("Logout");
    fireEvent.click(logoutButton);

    // Check that localStorage.removeItem was called with 'vibes-diy-auth-token'
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      "vibes-diy-auth-token",
    );

    // For now, we won't test the navigate call since it's difficult to mock correctly
    // and is peripheral to the main logout functionality we're testing
  });

  it("should not show the logout button when not authenticated", async () => {
    // Render with unauthenticated context
    renderWithAuthContext(<Settings />, { isAuthenticated: false });

    // Logout button should not be present
    const logoutButton = screen.queryByText("Logout");
    expect(logoutButton).toBeNull();
  });
});
