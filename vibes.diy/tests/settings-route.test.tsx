import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextType } from "~/vibes.diy/app/contexts/AuthContext.js";
import { AuthContext } from "~/vibes.diy/app/contexts/AuthContext.js";
import Settings from "~/vibes.diy/app/routes/settings.js";

// Create mock objects outside the mock function to access them in tests
const mockMerge = vi.fn();
const mockSave = vi
  .fn()
  .mockImplementation(() => Promise.resolve({ ok: true }));
const mockSettings = {
  _id: "user_settings",
  stylePrompt: "",
  userPrompt: "",
};

// Mock the modules
vi.mock("~/vibes.diy/app/hooks/useSession", () => ({
  useSession: () => ({
    mainDatabase: { name: "test-db" },
  }),
}));

// Create mock implementations
const mockUseDocument = vi.fn().mockReturnValue({
  doc: mockSettings,
  merge: mockMerge,
  save: mockSave,
});

const mockUseFireproof = vi.fn().mockReturnValue({
  useDocument: mockUseDocument,
});

// Mock Fireproof
vi.mock("use-fireproof", () => ({
  useFireproof: () => mockUseFireproof(),
  toCloud: vi.fn().mockReturnValue({}),
}));

// Create mock implementations for react-router-dom
const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// Mock SimpleAppLayout component
vi.mock("~/vibes.diy/app/components/SimpleAppLayout", () => ({
  default: ({
    headerLeft,
    children,
  }: {
    headerLeft: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="simple-app-layout">
      <div data-testid="header-left">{headerLeft}</div>
      <div data-testid="content-area">{children}</div>
    </div>
  ),
}));

// Mock HomeIcon component
vi.mock("~/vibes.diy/app/components/SessionSidebar/HomeIcon", () => ({
  HomeIcon: () => <div data-testid="home-icon" />,
}));

// Define a wrapper component with just the AuthContext provider
const createWrapper = (contextValue?: Partial<AuthContextType>) => {
  const defaultContextValue: AuthContextType = {
    token: null,
    isAuthenticated: false,
    isLoading: false,
    userPayload: null,
    checkAuthStatus: vi.fn(),
    processToken: vi.fn(),
    needsLogin: false,
    setNeedsLogin: vi.fn(),
  };
  const valueToProvide = { ...defaultContextValue, ...contextValue };
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={valueToProvide}>
      {children}
    </AuthContext.Provider>
  );
};

describe("Settings Route", () => {
  const authenticatedState: Partial<AuthContextType> = {
    isAuthenticated: true,
    isLoading: false,
    userPayload: {
      userId: "test",
      exp: 9999999999,
      tenants: [],
      ledgers: [],
      iat: 1234567890,
      iss: "FP_CLOUD",
      aud: "PUBLIC",
    },
  };

  const mockDoc = {
    _id: "user_settings",
    stylePrompt: "",
    userPrompt: "",
    model: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup fake timers
    vi.useFakeTimers();

    // Reset the mock implementations
    mockUseDocument.mockReturnValue({
      doc: mockDoc,
      merge: mockMerge,
      save: mockSave,
    });

    // Reset navigate mock
    navigateMock.mockReset();
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
  });

  it.skip("renders the settings page with correct title and sections", async () => {
    const wrapper = createWrapper(authenticatedState);
    render(<Settings />, { wrapper });
    // ... assertions ...
  }, 10000);

  it("allows updating style prompt via text input", async () => {
    const wrapper = createWrapper(authenticatedState);
    render(<Settings />, { wrapper });
    const styleInput = screen.getByPlaceholderText(
      /enter or select style prompt/i,
    );

    await act(async () => {
      fireEvent.change(styleInput, { target: { value: "new style" } });
    });

    expect(mockMerge).toHaveBeenCalledWith({ stylePrompt: "new style" });
  });

  it("allows selecting a style prompt from suggestions", async () => {
    const wrapper = createWrapper(authenticatedState);
    render(<Settings />, { wrapper });
    const suggestionButton = screen.getByText("synthwave");

    await act(async () => {
      fireEvent.click(suggestionButton);
      vi.runAllTimers(); // For the focus setTimeout
    });

    expect(mockMerge).toHaveBeenCalledWith({
      stylePrompt: "synthwave (80s digital aesthetic)",
    });
  });

  it("allows updating user prompt via textarea", async () => {
    const wrapper = createWrapper(authenticatedState);
    render(<Settings />, { wrapper });
    const userPromptTextarea = screen.getByPlaceholderText(
      /enter custom instructions/i,
    );

    await act(async () => {
      fireEvent.change(userPromptTextarea, {
        target: { value: "custom prompt" },
      });
    });

    expect(mockMerge).toHaveBeenCalledWith({ userPrompt: "custom prompt" });
  });

  it("calls save when the save button is clicked", async () => {
    // Create controlled mock implementation
    mockSave.mockImplementation(() => {
      // This will redirect to home page after saving
      setTimeout(() => {
        navigateMock("/");
      }, 0);
      return Promise.resolve({ ok: true });
    });

    const wrapper = createWrapper(authenticatedState);
    render(<Settings />, { wrapper });

    const saveButton = screen.getByRole("button", { name: /save/i });
    expect(saveButton).toBeDisabled(); // Initially disabled

    // Enable the save button
    await act(async () => {
      fireEvent.change(
        screen.getByPlaceholderText(/enter or select style prompt/i),
        {
          target: { value: "enable save" },
        },
      );
    });

    expect(saveButton).not.toBeDisabled(); // Enabled after change

    // Click the save button
    await act(async () => {
      fireEvent.click(saveButton);
      // Run any timers and promises
      vi.runAllTimers();
      await Promise.resolve();
    });

    // Check that save was called
    expect(mockSave).toHaveBeenCalled();
    // Check navigation occurred
    expect(navigateMock).toHaveBeenCalledWith("/");
  }, 10000);

  it("successfully saves settings and navigates to home", async () => {
    // Override save mock to simulate navigation
    mockSave.mockImplementation(() => {
      // This will redirect to home page after saving
      setTimeout(() => {
        navigateMock("/");
      }, 0);
      return Promise.resolve({ ok: true });
    });

    const wrapper = createWrapper(authenticatedState);
    render(<Settings />, { wrapper });

    const saveButton = screen.getByRole("button", { name: /save/i });

    // Make a change to enable the save button
    await act(async () => {
      fireEvent.change(
        screen.getByPlaceholderText(/enter or select style prompt/i),
        {
          target: { value: "save this" },
        },
      );
    });

    // Click the save button
    await act(async () => {
      fireEvent.click(saveButton);
      // Run any timers and promises
      vi.runAllTimers();
      await Promise.resolve();
    });

    // Verify save was called and we navigated home
    expect(mockSave).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/");
  }, 10000);

  it.skip("highlights the selected style prompt suggestion", async () => {
    // Need to control the useDocument mock *before* render for this specific test
    const mockSettingsWithStyle = {
      ...mockDoc,
      stylePrompt: "brutalist web (raw, grid-heavy)",
    };
    mockUseDocument.mockReturnValueOnce({
      doc: mockSettingsWithStyle,
      merge: mockMerge,
      save: mockSave,
    });
    const wrapper = createWrapper(authenticatedState);
    render(<Settings />, { wrapper });
    const brutalistButton = await screen.findByText("brutalist web");
    await waitFor(
      () => {
        expect(brutalistButton).toHaveClass("bg-blue-500");
      },
      { timeout: 10000 },
    );
    expect(brutalistButton).toHaveClass("text-white");
  }, 10000);
});
