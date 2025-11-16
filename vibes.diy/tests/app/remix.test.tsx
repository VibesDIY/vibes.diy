import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Remix from "~/vibes.diy/app/routes/remix.js";

// Mock useLazyFireproof first
vi.mock("~/vibes.diy/app/hooks/useLazyFireproof", () => ({
  useLazyFireproof: () => ({
    useDocument: () => ({
      doc: { _id: "test-id", type: "user" },
      merge: vi.fn(),
      submit: vi.fn().mockResolvedValue({ ok: true }),
      save: vi.fn(),
    }),
    useLiveQuery: () => ({ docs: [] }),
    database: { get: vi.fn(), put: vi.fn() },
    open: vi.fn(),
  }),
}));

// Mock @clerk/clerk-react
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    userId: "test-user-id",
    isLoaded: true,
    isSignedIn: true,
  }),
}));

// Mock the API Key hook
vi.mock("~/vibes.diy/app/hooks/useApiKey", () => ({
  useApiKey: () => ({
    apiKey: "test-api-key",
  }),
}));

// Mock variables for React Router
let locationMock = {
  search: "?prompt=Make+it+pink",
  pathname: "/remix/test-app-slug",
};

// Mock React Router
vi.mock("react-router", () => ({
  useParams: () => ({ vibeSlug: "test-app-slug" }),
  useNavigate: () => vi.fn(), // Still needed by the component even though we don't use it in tests
  useLocation: () => locationMock,
}));

// Mock fetch
vi.stubGlobal(
  "fetch",
  vi.fn().mockImplementation(() => {
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      text: () =>
        Promise.resolve(
          "export default function App() { return <div>Test App</div>; }",
        ),
      json: () => Promise.resolve({}),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      formData: () => Promise.resolve(new FormData()),
    });
  }),
);

// Mock the utils
vi.mock("~/components/SessionSidebar/utils", () => ({
  encodeTitle: (title: string) => title,
}));

// Mock database manager
vi.mock("~/vibes.diy/app/utils/databaseManager", () => ({
  getSessionDatabaseName: vi
    .fn()
    .mockImplementation((id) => `session-${id || "default"}`),
}));

describe("Remix Route", () => {
  beforeEach(() => {
    // Reset mocks before each test (navigateMock no longer needed)

    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn().mockReturnValue("test-auth-token"),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  it("should process vibe slug and navigate with prompt parameter", async () => {
    // Set up location with prompt parameter
    locationMock = {
      search: "?prompt=Make+it+pink",
      pathname: "/remix/test-app-slug",
    };

    const mockOnNavigate = vi.fn();
    render(<Remix onNavigate={mockOnNavigate} />);
    // Verify loading screen is displayed
    expect(screen.getByText(/REMIXING TEST-APP-SLUG/i)).toBeInTheDocument();

    // Wait for the navigation to occur with the prompt parameter
    await waitFor(() => {
      expect(mockOnNavigate).toHaveBeenCalled();
      // Check that the URL contains the expected parts
      const callArg = mockOnNavigate.mock.calls[0][0];
      expect(callArg).toContain("/chat/");
      expect(callArg).toContain("/chat?prompt=Make");
    });
  });

  it("should handle missing prompt parameter correctly", async () => {
    // Set up location without prompt parameter
    locationMock = { search: "", pathname: "/remix/test-app-slug" };

    const mockOnNavigate = vi.fn();
    render(<Remix onNavigate={mockOnNavigate} />);

    // Wait for the navigation to occur without prompt parameter
    await waitFor(() => {
      expect(mockOnNavigate).toHaveBeenCalled();
      expect(mockOnNavigate).toHaveBeenCalledWith(
        expect.stringMatching(/\/chat\/.*\/.*\/chat$/),
      );
      expect(mockOnNavigate).not.toHaveBeenCalledWith(
        expect.stringMatching(/\?prompt=/),
      );
    });
  });
});
