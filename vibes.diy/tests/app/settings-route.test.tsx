import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import Settings from "~/vibes.diy/app/routes/settings.js";

// Create mock objects outside the mock function to access them in tests
const mocks = vi.hoisted(() => {
  const mockMerge = vi.fn();
  const mockSave = vi
    .fn()
    .mockImplementation(() => Promise.resolve({ ok: true }));
  const mockSettings = {
    _id: "user_settings",
    stylePrompt: "",
    userPrompt: "",
  };
  const mockUseDocument = vi.fn().mockReturnValue({
    doc: mockSettings,
    merge: mockMerge,
    save: mockSave,
  });
  const mockUseFireproof = vi.fn().mockReturnValue({
    useDocument: mockUseDocument,
  });
  const navigateMock = vi.fn();
  const mockUseAuth = vi.fn();

  return {
    mockMerge,
    mockSave,
    mockSettings,
    mockUseDocument,
    mockUseFireproof,
    navigateMock,
    mockUseAuth,
  };
});

// Mock the modules
vi.mock("~/vibes.diy/app/hooks/useSession", () => ({
  useSession: () => ({
    mainDatabase: { name: "test-db" },
  }),
}));

// Mock Fireproof
vi.mock("use-fireproof", () => ({
  useFireproof: () => mocks.mockUseFireproof(),
  ImgFile: vi.fn(),
  fireproof: vi.fn(),
  toCloud: vi.fn(),
}));

// Create mock implementations for react-router-dom
vi.mock("react-router-dom", async () => {
  const { vi } = await import("vitest");
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => mocks.navigateMock,
  };
});

// Mock BrutalistLayout component
vi.mock("~/vibes.diy/app/components/BrutalistLayout", () => ({
  default: ({
    children,
    title,
    subtitle,
    headerActions,
  }: {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    headerActions?: React.ReactNode;
  }) => (
    <div data-testid="brutalist-layout">
      <div data-testid="layout-title">{title}</div>
      {subtitle && <div data-testid="layout-subtitle">{subtitle}</div>}
      {headerActions && <div data-testid="header-actions">{headerActions}</div>}
      <div data-testid="content-area">{children}</div>
    </div>
  ),
}));

// Mock LoggedOutView
vi.mock("~/vibes.diy/app/components/LoggedOutView", () => ({
  default: () => <div data-testid="logged-out-view">Please sign in</div>,
}));

// Mock @clerk/clerk-react
vi.mock("@clerk/clerk-react", () => ({
  useAuth: mocks.mockUseAuth,
  useClerk: () => ({
    redirectToSignIn: vi.fn(),
    signOut: vi.fn(),
  }),
  useUser: () => ({
    user: {
      primaryEmailAddress: { emailAddress: "test@example.com" },
    },
  }),
  useSession: () => ({
    session: { id: "test-session-id" },
    isLoaded: true,
  }),
}));

describe("Settings Route", () => {
  const mockDoc = {
    _id: "user_settings",
    stylePrompt: "",
    userPrompt: "",
    model: "",
  };

  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    vi.clearAllMocks();
    // Setup fake timers
    vi.useFakeTimers();

    // Reset the mock implementations
    mocks.mockUseDocument.mockReturnValue({
      doc: mockDoc,
      merge: mocks.mockMerge,
      save: mocks.mockSave,
    });

    // Reset navigate mock
    mocks.navigateMock.mockReset();
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
  });

  it.skip("renders the settings page with correct title and sections", async () => {
    mocks.mockUseAuth.mockReturnValue({
      userId: "test",
      isLoaded: true,
      isSignedIn: true,
    });
    render(<Settings />);
    // ... assertions ...
  }, 10000);

  it("allows updating style prompt via text input", async () => {
    mocks.mockUseAuth.mockReturnValue({
      userId: "test",
      isLoaded: true,
      isSignedIn: true,
    });
    render(<Settings />);
    const styleInput = screen.getByPlaceholderText(
      /enter or select style prompt/i,
    );

    await act(async () => {
      fireEvent.change(styleInput, { target: { value: "new style" } });
    });

    expect(mocks.mockMerge).toHaveBeenCalledWith({ stylePrompt: "new style" });
  });

  it("allows selecting a style prompt from suggestions", async () => {
    mocks.mockUseAuth.mockReturnValue({
      userId: "test",
      isLoaded: true,
      isSignedIn: true,
    });
    render(<Settings />);
    const suggestionButton = screen.getByText("synthwave");

    await act(async () => {
      fireEvent.click(suggestionButton);
      vi.runAllTimers(); // For the focus setTimeout
    });

    expect(mocks.mockMerge).toHaveBeenCalledWith({
      stylePrompt: "synthwave (80s digital aesthetic)",
    });
  });

  it("allows updating user prompt via textarea", async () => {
    mocks.mockUseAuth.mockReturnValue({
      userId: "test",
      isLoaded: true,
      isSignedIn: true,
    });
    render(<Settings />);
    const userPromptTextarea = screen.getByPlaceholderText(
      /enter custom instructions/i,
    );

    await act(async () => {
      fireEvent.change(userPromptTextarea, {
        target: { value: "custom prompt" },
      });
    });

    expect(mocks.mockMerge).toHaveBeenCalledWith({
      userPrompt: "custom prompt",
    });
  });

  it("calls save when the save button is clicked", async () => {
    // Create controlled mock implementation
    mocks.mockSave.mockImplementation(() => {
      // This will redirect to home page after saving
      setTimeout(() => {
        mocks.navigateMock("/");
      }, 0);
      return Promise.resolve({ ok: true });
    });

    mocks.mockUseAuth.mockReturnValue({
      userId: "test",
      isLoaded: true,
      isSignedIn: true,
    });
    render(<Settings />);

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
    expect(mocks.mockSave).toHaveBeenCalled();
    // Check navigation occurred
    expect(mocks.navigateMock).toHaveBeenCalledWith("/");
  }, 10000);

  it("successfully saves settings and navigates to home", async () => {
    // Override save mock to simulate navigation
    mocks.mockSave.mockImplementation(() => {
      // This will redirect to home page after saving
      setTimeout(() => {
        mocks.navigateMock("/");
      }, 0);
      return Promise.resolve({ ok: true });
    });

    mocks.mockUseAuth.mockReturnValue({
      userId: "test",
      isLoaded: true,
      isSignedIn: true,
    });
    render(<Settings />);

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
    expect(mocks.mockSave).toHaveBeenCalled();
    expect(mocks.navigateMock).toHaveBeenCalledWith("/");
  }, 10000);

  it.skip("highlights the selected style prompt suggestion", async () => {
    // Need to control the useDocument mock *before* render for this specific test
    const mockSettingsWithStyle = {
      ...mockDoc,
      stylePrompt: "brutalist web (raw, grid-heavy)",
    };
    mocks.mockUseDocument.mockReturnValueOnce({
      doc: mockSettingsWithStyle,
      merge: mocks.mockMerge,
      save: mocks.mockSave,
    });
    mocks.mockUseAuth.mockReturnValue({
      userId: "test",
      isLoaded: true,
      isSignedIn: true,
    });
    render(<Settings />);
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
