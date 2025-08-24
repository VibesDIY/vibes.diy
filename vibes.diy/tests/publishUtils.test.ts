import { afterEach, beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { normalizeComponentExports } from "~/vibes.diy/app/utils/normalizeComponentExports.js";
import { publishApp } from "~/vibes.diy/app/utils/publishUtils.js";

// Mock dependencies
vi.mock("use-fireproof");
vi.mock("~/vibes.diy/app/utils/databaseManager.js");
vi.mock("~/vibes.diy/app/utils/normalizeComponentExports.js");
vi.mock("~/vibes.diy/app/utils/catalogUtils.js");

// Import mocked modules
import { fireproof } from "use-fireproof";
import { getSessionDatabaseName } from "~/vibes.diy/app/utils/databaseManager.js";
import { addCatalogScreenshotStandalone } from "~/vibes.diy/app/utils/catalogUtils.js";

// We need to mock the import.meta.env
vi.stubGlobal("import", {
  meta: {
    env: {
      VITE_API_BASE_URL: "http://test-api-url",
    },
  },
});

// Mock global fetch
const mockFetch = vi.fn().mockImplementation(async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    success: true,
    app: {
      slug: "test-app-slug",
    },
    appUrl: "https://test-app-slug.vibesdiy.app",
  }),
}));
global.fetch = mockFetch;

// Setup mock FileReader for screenshot processing
class MockFileReader {
  onload: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  result: string | null = null;

  readAsDataURL(_file: Blob): void {
    this.result = "data:image/png;base64,mockScreenshotBase64Data";
    if (this.onload) this.onload();
  }
}

global.FileReader = MockFileReader as typeof FileReader;

// Setup mock Fireproof database and query results
const mockVibeDoc = {
  _id: "vibe",
  title: "Test App",
  remixOf: "original-app.vibesdiy.app",
};

const mockScreenshotDoc = {
  _id: "screenshot-1",
  type: "screenshot",
  _files: {
    screenshot: {
      file: vi
        .fn()
        .mockResolvedValue(
          new Blob(["mockScreenshotData"], { type: "image/png" }),
        ),
    },
  },
};

const mockQueryResult = {
  rows: [{ doc: mockScreenshotDoc }],
};

const mockFireproofDb = {
  get: vi.fn(),
  query: vi.fn(),
};

describe("publishApp", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();

    // Setup our mocks with default behavior
    mockFireproofDb.get.mockImplementation(async (id) => {
      if (id === "vibe") return mockVibeDoc;
      throw new Error("Doc not found");
    });

    mockFireproofDb.query.mockResolvedValue(mockQueryResult);

    (fireproof as Mock).mockReturnValue(mockFireproofDb);
    (getSessionDatabaseName as Mock).mockReturnValue("test-session-db");
    (normalizeComponentExports as Mock).mockImplementation(
      (code: string) => code,
    );
    (addCatalogScreenshotStandalone as Mock).mockResolvedValue(undefined);

    // Re-setup fetch mock after reset
    mockFetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        app: {
          slug: "test-app-slug",
        },
        appUrl: "https://test-app-slug.vibesdiy.app",
      }),
    }));
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("includes remixOf metadata in the API payload when publishing an app with remix info", async () => {
    // Arrange: Setup a test case with remix metadata present
    const sessionId = "test-session-id";
    const testCode =
      "const App = () => <div>Hello World</div>; export default App;";
    const testTitle = "Remixed Test App";
    const updatePublishedUrl = vi.fn();
    const userId = "test-user-id";
    const testPrompt = "Create a hello world app";

    // Act: Call the publishApp function
    await publishApp({
      sessionId,
      code: testCode,
      title: testTitle,
      userId,
      prompt: testPrompt,
      updatePublishedUrl,
      token: "test-jwt-token",
    });

    // Assert: Check that fetch was called and included remixOf in the payload
    expect(mockFetch).toHaveBeenCalled();

    // Get the called arguments
    const [_url, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);

    // Verify remixOf is included in the payload
    expect(payload).toHaveProperty("remixOf", "original-app.vibesdiy.app");
    expect(payload).toHaveProperty("title", testTitle);
    expect(payload).toHaveProperty("chatId", sessionId);
  });

  it("handles the case when no remix metadata is present", async () => {
    // Arrange: Setup without remix metadata
    const sessionId = "no-remix-session";
    const testCode =
      "const App = () => <div>Original App</div>; export default App;";
    const testTitle = "Original Test App";

    // Mock Fireproof to throw an error when trying to get the vibe doc
    mockFireproofDb.get.mockRejectedValueOnce(new Error("Doc not found"));

    // Act: Call the publishApp function
    await publishApp({
      sessionId,
      code: testCode,
      title: testTitle,
      userId: "test-user-id",
      prompt: "Create an original app",
      token: null,
    });

    // Assert: Check that fetch was called with null remixOf
    expect(mockFetch).toHaveBeenCalled();

    const [_url, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);

    // Verify remixOf is null in the payload
    expect(payload.remixOf).toBeNull();
  });

  it("includes screenshot in the API payload when available", async () => {
    // Arrange - screenshot is already set up in the mock
    const sessionId = "test-session-id";
    const testCode =
      "const App = () => <div>App with Screenshot</div>; export default App;";

    // Act: Call the publishApp function
    await publishApp({
      sessionId,
      code: testCode,
      userId: "test-user-id",
      prompt: "Create an app with screenshot",
      token: "test-token",
    });

    // Assert: Check that the screenshot was included
    expect(mockFetch).toHaveBeenCalled();

    const [_url, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);

    // Verify screenshot is included in the payload
    expect(payload).toHaveProperty("screenshot", "mockScreenshotBase64Data");
  });

  it("includes Authorization header when token is provided", async () => {
    // Arrange
    const sessionId = "test-session-id";
    const testCode =
      "const App = () => <div>Authenticated App</div>; export default App;";
    const testToken = "test-jwt-token-123";

    // Act: Call the publishApp function with token
    await publishApp({
      sessionId,
      code: testCode,
      userId: "test-user-id",
      prompt: "Create an app with authentication",
      token: testToken,
    });

    // Assert: Check that the Authorization header was included
    expect(mockFetch).toHaveBeenCalled();

    const [_url, options] = mockFetch.mock.calls[0];
    expect(options.headers).toHaveProperty(
      "Authorization",
      `Bearer ${testToken}`,
    );
    expect(options.headers).toHaveProperty("Content-Type", "application/json");
  });

  it("does not include Authorization header when token is null", async () => {
    // Arrange
    const sessionId = "test-session-id";
    const testCode =
      "const App = () => <div>Unauthenticated App</div>; export default App;";

    // Act: Call the publishApp function without token
    await publishApp({
      sessionId,
      code: testCode,
      userId: "test-user-id",
      prompt: "Create an app without authentication",
      token: null,
    });

    // Assert: Check that no Authorization header was included
    expect(mockFetch).toHaveBeenCalled();

    const [_url, options] = mockFetch.mock.calls[0];
    expect(options.headers).not.toHaveProperty("Authorization");
    expect(options.headers).toHaveProperty("Content-Type", "application/json");
  });

  it("calls addCatalogScreenshotStandalone with correct parameters when publishing", async () => {
    // Arrange
    const sessionId = "test-session-id";
    const userId = "test-user-id";
    const testCode =
      "const App = () => <div>Test App</div>; export default App;";
    const normalizedCode = "normalized-code";

    // Mock normalized exports to return a specific value
    (normalizeComponentExports as Mock).mockReturnValue(normalizedCode);

    // Act: Call the publishApp function
    await publishApp({
      sessionId,
      code: testCode,
      userId,
      prompt: "Create a test app",
      token: "test-token",
    });

    // Assert: Check that addCatalogScreenshotStandalone was called with correct parameters
    expect(addCatalogScreenshotStandalone).toHaveBeenCalledWith(
      userId,
      sessionId,
      expect.stringMatching(/^data:image\/png;base64,/), // Screenshot data URL
      normalizedCode, // Transformed source code
    );
  });
});
