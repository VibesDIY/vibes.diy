import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { publishApp } from '../app/utils/publishUtils';
import { normalizeComponentExports } from '../app/utils/normalizeComponentExports';

// Mock dependencies
vi.mock('use-fireproof');
vi.mock('../app/utils/databaseManager');
vi.mock('../app/utils/normalizeComponentExports');

// Import mocked modules
import { fireproof } from 'use-fireproof';
import { getSessionDatabaseName } from '../app/utils/databaseManager';

// We need to mock the import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_API_BASE_URL: 'http://test-api-url',
    },
  },
});

// Mock global fetch
const mockFetch = vi.fn().mockImplementation(async () => ({
  ok: true,
  json: async () => ({ url: 'https://test-app.vibecode.garden' }),
}));
global.fetch = mockFetch;

// Setup mock FileReader for screenshot processing
class MockFileReader {
  onload: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  result: string | null = null;

  readAsDataURL(file: Blob): void {
    this.result = 'data:image/png;base64,mockScreenshotBase64Data';
    if (this.onload) this.onload();
  }
}

global.FileReader = MockFileReader as any;

// Setup mock Fireproof database and query results
const mockVibeDoc = {
  _id: 'vibe',
  title: 'Test App',
  remixOf: 'original-app.vibecode.garden',
};

const mockScreenshotDoc = {
  _id: 'screenshot-1',
  type: 'screenshot',
  _files: {
    screenshot: {
      file: vi.fn().mockResolvedValue(new Blob(['mockScreenshotData'], { type: 'image/png' })),
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

describe('publishApp', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();

    // Setup our mocks with default behavior
    mockFireproofDb.get.mockImplementation(async (id) => {
      if (id === 'vibe') return mockVibeDoc;
      throw new Error('Doc not found');
    });

    mockFireproofDb.query.mockResolvedValue(mockQueryResult);

    (fireproof as any).mockReturnValue(mockFireproofDb);
    (getSessionDatabaseName as any).mockReturnValue('test-session-db');
    (normalizeComponentExports as any).mockImplementation((code: string) => code);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('includes remixOf metadata in the API payload when publishing an app with remix info', async () => {
    // Arrange: Setup a test case with remix metadata present
    const sessionId = 'test-session-id';
    const testCode = 'const App = () => <div>Hello World</div>; export default App;';
    const testTitle = 'Remixed Test App';
    const updatePublishedUrl = vi.fn();

    // Act: Call the publishApp function
    await publishApp({
      sessionId,
      code: testCode,
      title: testTitle,
      updatePublishedUrl,
    });

    // Assert: Check that fetch was called and included remixOf in the payload
    expect(mockFetch).toHaveBeenCalled();

    // Get the called arguments
    const [_url, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);

    // Verify remixOf is included in the payload
    expect(payload).toHaveProperty('remixOf', 'original-app.vibecode.garden');
    expect(payload).toHaveProperty('title', testTitle);
    expect(payload).toHaveProperty('chatId', sessionId);
  });

  it('handles the case when no remix metadata is present', async () => {
    // Arrange: Setup without remix metadata
    const sessionId = 'no-remix-session';
    const testCode = 'const App = () => <div>Original App</div>; export default App;';
    const testTitle = 'Original Test App';

    // Mock Fireproof to throw an error when trying to get the vibe doc
    mockFireproofDb.get.mockRejectedValueOnce(new Error('Doc not found'));

    // Act: Call the publishApp function
    await publishApp({
      sessionId,
      code: testCode,
      title: testTitle,
    });

    // Assert: Check that fetch was called with null remixOf
    expect(mockFetch).toHaveBeenCalled();

    const [_url, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);

    // Verify remixOf is null in the payload
    expect(payload.remixOf).toBeNull();
  });

  it('includes screenshot in the API payload when available', async () => {
    // Arrange - screenshot is already set up in the mock
    const sessionId = 'test-session-id';
    const testCode = 'const App = () => <div>App with Screenshot</div>; export default App;';

    // Act: Call the publishApp function
    await publishApp({
      sessionId,
      code: testCode,
    });

    // Assert: Check that the screenshot was included
    expect(mockFetch).toHaveBeenCalled();

    const [_url, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);

    // Verify screenshot is included in the payload
    expect(payload).toHaveProperty('screenshot', 'mockScreenshotBase64Data');
  });
});
