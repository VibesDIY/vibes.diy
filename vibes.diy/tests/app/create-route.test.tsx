import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import Create from "~/vibes.diy/app/routes/create.js";

// Mock react-router
const mockNavigate = vi.fn();
const mockLocation = { pathname: "/create" };
const mockParams = {};
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  useParams: () => mockParams,
  Outlet: () => <div data-testid="outlet">Outlet</div>,
}));

// Mock use-fireproof - preserve all other exports
const mockPut = vi.fn();
const mockDatabase = { put: mockPut };
vi.mock("use-fireproof", async (importActual) => {
  const actual = (await importActual()) as typeof import("use-fireproof");
  return {
    ...actual,
    useFireproof: () => ({
      database: mockDatabase,
    }),
  };
});

// Mock BrutalistCard and VibesButton - simple mocks without preserving exports
vi.mock("@vibes.diy/use-vibes-base", () => ({
  BrutalistCard: ({
    children,
    size,
  }: {
    children: React.ReactNode;
    size?: string;
  }) => (
    <div data-testid="brutalist-card" data-size={size}>
      {children}
    </div>
  ),
  VibesButton: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button
      data-testid="vibes-button"
      data-variant={variant}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  ),
}));

// Mock parseContent - preserve all other exports
vi.mock("@vibes.diy/prompts", async (importActual) => {
  const actual = (await importActual()) as typeof import("@vibes.diy/prompts");
  return {
    ...actual,
    parseContent: vi.fn((_text: string) => ({
      segments: [
        { type: "markdown", content: "Generating your app..." },
        {
          type: "code",
          content: "function App() {\n  return <div>Hello</div>;\n}",
        },
        { type: "markdown", content: "Your app is ready!" },
      ],
    })),
  };
});

// Mock ReactMarkdown
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="react-markdown">{children}</div>
  ),
}));

// Mock useSimpleChat
const mockSendMessage = vi.fn();
const mockSetInput = vi.fn();
const mockChatState = {
  docs: [
    {
      type: "ai",
      text: "Generating your app...\n\n```jsx\nfunction App() {\n  return <div>Hello</div>;\n}\n```\n\nYour app is ready!",
      created_at: Date.now(),
    },
  ],
  isStreaming: false,
  sendMessage: mockSendMessage,
  setInput: mockSetInput,
};

vi.mock("~/vibes.diy/app/hooks/useSimpleChat.js", () => ({
  useSimpleChat: vi.fn(() => mockChatState),
}));

// Mock quick suggestion data
vi.mock("~/vibes.diy/app/data/quick-suggestions-data.js", () => ({
  partyPlannerPrompt: "Create a party planner app",
  progressTrackerPrompt: "Create a progress tracker",
  jamSessionPrompt: "Create a music collaboration tool",
}));

describe("Create Route", () => {
  beforeEach(() => {
    cleanup(); // Force cleanup before each test
    vi.clearAllMocks();
    mockPut.mockResolvedValue({ id: "test-session-id-123" });
    mockNavigate.mockClear();
    mockLocation.pathname = "/create";
    // Ensure no sessionId in params for base tests
    delete (mockParams as { sessionId?: string }).sessionId;
  });

  it("renders the create page with title and form", () => {
    render(<Create />);

    expect(screen.getAllByText("Vibes are for sharing")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Describe your vibe")[0]).toBeInTheDocument();
    expect(
      screen.getAllByPlaceholderText("What do you want to build...")[0],
    ).toBeInTheDocument();
  });

  it("renders quick suggestion buttons", () => {
    render(<Create />);

    expect(screen.getAllByText("Party Planner")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Progress Tracker")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Jam Session")[0]).toBeInTheDocument();
  });

  it("fills textarea when quick suggestion button is clicked", () => {
    render(<Create />);

    const partyButton = screen.getAllByText("Party Planner")[0];
    fireEvent.click(partyButton);

    const textarea = screen.getAllByPlaceholderText(
      "What do you want to build...",
    )[0] as HTMLTextAreaElement;
    expect(textarea.value).toBe("Create a party planner app");
  });

  it("allows user to type in textarea", () => {
    render(<Create />);

    const textarea = screen.getAllByPlaceholderText(
      "What do you want to build...",
    )[0] as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "My custom app idea" } });

    expect(textarea.value).toBe("My custom app idea");
  });

  it("renders Let's Go button initially enabled", () => {
    render(<Create />);

    const button = screen.getAllByText("Let's Go")[0];
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("creates a Fireproof document and navigates when Let's Go is clicked", async () => {
    render(<Create />);

    const textarea = screen.getAllByPlaceholderText(
      "What do you want to build...",
    )[0] as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Build a todo app" } });

    const button = screen.getAllByText("Let's Go")[0];
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith({
        type: "create-session",
        prompt: "Build a todo app",
        created_at: expect.any(Number),
      });
      expect(mockNavigate).toHaveBeenCalledWith("/create/test-session-id-123");
    });
  });

  it("disables button when sessionId is in params", () => {
    // Set sessionId in params to simulate being on /create/:sessionId route
    (mockParams as { sessionId?: string }).sessionId = "test-session-id-123";

    render(<Create />);

    const button = screen.getAllByText("Generating...")[0];
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();

    // Clean up
    delete (mockParams as { sessionId?: string }).sessionId;
  });

  it("navigates to session route after Let's Go is clicked", async () => {
    render(<Create />);

    const textarea = screen.getAllByPlaceholderText(
      "What do you want to build...",
    )[0] as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Build a todo app" } });

    const button = screen.getAllByText("Let's Go")[0];
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/create/test-session-id-123");
    });
  });

  it("does not create session if textarea is empty", async () => {
    // Explicitly clear mock before this test since it's sensitive to call count
    mockPut.mockClear();
    mockNavigate.mockClear();

    const { unmount } = render(<Create />);

    // Verify textarea is empty
    const textarea = screen.getAllByPlaceholderText(
      "What do you want to build...",
    )[0] as HTMLTextAreaElement;
    expect(textarea.value).toBe("");

    const button = screen.getAllByText("Let's Go")[0];
    fireEvent.click(button);

    // Wait a tick to ensure any async operations would have completed
    await waitFor(
      () => {
        // Should not call put with empty prompt
        expect(mockPut).not.toHaveBeenCalled();
      },
      { timeout: 100 },
    );

    unmount();
  });

  it("renders Learn link", () => {
    render(<Create />);

    const learnLink = screen.getAllByText("Learn")[0];
    expect(learnLink).toBeInTheDocument();
    expect(learnLink).toHaveAttribute("href", "/");
  });

  it("renders CreateWithStreaming when sessionId is in params", () => {
    // Set sessionId in params to simulate being on /create/:sessionId route
    (mockParams as { sessionId?: string }).sessionId = "test-session-id-123";

    render(<Create />);

    // Verify CreateWithStreaming component is rendered (which uses the session ID)
    // by checking that streaming content appears
    expect(
      screen.getAllByText("Generating your app...")[0],
    ).toBeInTheDocument();

    // Clean up
    delete (mockParams as { sessionId?: string }).sessionId;
  });
});

describe("CreateWithStreaming Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPut.mockResolvedValue({ id: "test-session-id-456" });
    mockNavigate.mockClear();
    mockLocation.pathname = "/create/test-session-id-456";
    // Set sessionId in params for all CreateWithStreaming tests
    (mockParams as { sessionId?: string }).sessionId = "test-session-id-456";
  });

  afterEach(() => {
    // Clean up params after each test
    delete (mockParams as { sessionId?: string }).sessionId;
  });

  it("renders streaming content when session is created", () => {
    render(<Create />);

    expect(
      screen.getAllByText("Generating your app...")[0],
    ).toBeInTheDocument();
  });

  it("displays code segment with line count", () => {
    render(<Create />);
    expect(screen.getAllByText(/3 lines/)[0]).toBeInTheDocument();
  });

  it("displays copy button with App.jsx label", () => {
    render(<Create />);
    expect(screen.getAllByText("App.jsx")[0]).toBeInTheDocument();
  });

  it("displays last 3 lines of code as preview", () => {
    render(<Create />);
    // The code should show last 3 lines
    const codeElement = screen.getAllByText(/return <div>Hello<\/div>/)[0];
    expect(codeElement).toBeInTheDocument();
  });

  it("initializes streaming when session is created", () => {
    render(<Create />);

    // Verify that CreateWithStreaming renders and displays content
    expect(
      screen.getAllByText("Generating your app...")[0],
    ).toBeInTheDocument();
    expect(screen.getAllByText("Your app is ready!")[0]).toBeInTheDocument();
  });

  it("displays final markdown segment", () => {
    render(<Create />);
    expect(screen.getAllByText("Your app is ready!")[0]).toBeInTheDocument();
  });

  it("shows button as Generating when sessionId exists", () => {
    render(<Create />);

    // The button should show "Generating..." when sessionId is in params
    expect(screen.getAllByText("Generating...")[0]).toBeInTheDocument();
  });

  it("copies code to clipboard when copy button is clicked", () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    // Mock navigator.clipboard using Object.defineProperty
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    render(<Create />);

    // App.jsx button should already be visible since sessionId is set
    const copyButton = screen.getAllByText("App.jsx")[0].closest("button");
    if (copyButton) {
      fireEvent.click(copyButton);

      expect(writeTextMock).toHaveBeenCalledWith(
        "function App() {\n  return <div>Hello</div>;\n}",
      );
    }
  });
});
