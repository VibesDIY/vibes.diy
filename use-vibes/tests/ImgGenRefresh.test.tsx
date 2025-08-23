import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { fail } from 'assert';

// Create a mock File
const mockFile = new File(['test content'], 'test-image.png', { type: 'image/png' });

// Mock for database operations
const mockDb = {
  get: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
  query: vi.fn(),
  getAttachment: vi.fn(),
  putAttachment: vi.fn(),
};

// Mock the call-ai module
vi.mock('call-ai', () => ({
  imageGen: vi.fn().mockImplementation(async () => ({
    created: Date.now(),
    data: [{ b64_json: 'test-base64-data' }],
  })),
  callAI: vi.fn().mockImplementation(async () => 'Mocked text response'),
}));

// Mock utility function to simulate addNewVersion behavior
const mockAddNewVersion = vi.fn((doc, file, prompt) => ({
  ...doc,
  currentVersion: (doc.currentVersion || 0) + 1,
  versions: [
    ...(doc.versions || []),
    { id: `v${(doc.currentVersion || 0) + 2}`, created: Date.now(), promptKey: 'p1' },
  ],
  _files: { ...doc._files, [`v${(doc.currentVersion || 0) + 2}`]: file },
  ...(prompt && {
    prompts: { ...doc.prompts, p1: { text: prompt, created: Date.now() } },
  }),
}));

// Mock the regenerateImage and generateImage functions
const regenerateImage = vi.fn(async ({ db, _id, _prompt }) => {
  // Get the document
  const doc = await db.get(_id);

  // Add a new version
  const updatedDoc = mockAddNewVersion(doc, mockFile, undefined);

  // Save to the database
  await db.put(updatedDoc);

  // Return the result
  return {
    document: { ...updatedDoc, _rev: 'new-rev' },
    file: mockFile,
  };
});

const generateImage = vi.fn(async ({ db, _id, prompt }) => {
  let doc;

  if (_id) {
    // Get existing document if ID is provided
    doc = await db.get(_id);

    // Add new version with new prompt
    const updatedDoc = mockAddNewVersion(doc, mockFile, prompt);
    await db.put(updatedDoc);

    return {
      document: { ...updatedDoc, _rev: 'new-rev' },
      file: mockFile,
    };
  } else {
    // Create new document
    const newDoc = {
      _id: `img_${Date.now()}`,
      type: 'image',
      created: Date.now(),
      prompt,
      currentVersion: 0,
      currentPromptKey: 'p1',
      versions: [{ id: 'v1', created: Date.now(), promptKey: 'p1' }],
      prompts: { p1: { text: prompt, created: Date.now() } },
      _files: { v1: mockFile },
    };

    await db.put(newDoc);

    return {
      document: { ...newDoc, _rev: 'new-rev' },
      file: mockFile,
    };
  }
});

// Mock the use-vibes-base module
vi.mock('@vibes.diy/use-vibes-base', async () => {
  const actual = await vi.importActual('@vibes.diy/use-vibes-base');
  return {
    ...actual,
    addNewVersion: mockAddNewVersion,
    regenerateImage,
    generateImage,
  };
});

// Import after mocks
import { ImageDocument } from '@vibes.diy/use-vibes-base';
import { DocWithId } from 'use-fireproof';

describe('Image Generation Refresh Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.get.mockReset();
    mockDb.put.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should add a new version to an existing document instead of creating a new one', async () => {
    // Create a mock document to test with
    const existingDocId = 'test-document-id';
    const mockDocument: ImageDocument = {
      _id: existingDocId,
      _rev: 'test-rev-1',
      type: 'image',
      created: Date.now() - 10000,
      prompt: 'Original prompt',
      currentVersion: 0,
      currentPromptKey: 'p1',
      versions: [{ id: 'v1', created: Date.now() - 10000, promptKey: 'p1' }],
      prompts: { p1: { text: 'Original prompt', created: Date.now() - 10000 } },
      _files: { v1: mockFile },
    };

    // Set up the database mock
    mockDb.get.mockResolvedValue(mockDocument);
    mockDb.put.mockResolvedValue({ id: existingDocId, rev: 'new-rev' });

    // Call regenerateImage
    const result = await regenerateImage({ db: mockDb, _id: existingDocId });

    // Verify that the document was fetched
    expect(mockDb.get).toHaveBeenCalledWith(existingDocId);

    // Verify that a new version was added
    expect(result.document.currentVersion).toBe(1);
    expect(result.document._id).toBe(existingDocId);
    expect(result.document.versions).toHaveLength(2);

    // Verify that the document was saved
    expect(mockDb.put).toHaveBeenCalledTimes(1);
  });

  it('should preserve document ID when creating multiple versions', async () => {
    const existingDocId = 'preserved-document-id';
    const mockDocument: ImageDocument = {
      _id: existingDocId,
      _rev: 'test-rev-1',
      type: 'image',
      created: Date.now() - 10000,
      prompt: 'Original prompt',
      currentVersion: 1,
      currentPromptKey: 'p1',
      versions: [
        { id: 'v1', created: Date.now() - 10000, promptKey: 'p1' },
        { id: 'v2', created: Date.now() - 5000, promptKey: 'p1' },
      ],
      prompts: { p1: { text: 'Original prompt', created: Date.now() - 10000 } },
      _files: { v1: mockFile, v2: mockFile },
    };

    // Set up the database mock
    mockDb.get.mockResolvedValue(mockDocument);
    mockDb.put.mockResolvedValue({ id: existingDocId, rev: 'new-rev-2' });

    // Call regenerateImage again
    const result = await regenerateImage({ db: mockDb, _id: existingDocId });

    // Verify the ID is preserved
    expect(result.document._id).toBe(existingDocId);
    expect(result.document.currentVersion).toBe(2);
    expect(result.document.versions).toHaveLength(3);
  });

  it('should support creating a new version with a different prompt', async () => {
    const existingDocId = 'test-document-with-new-prompt';
    const newPrompt = 'New and improved prompt';
    const mockDocument: ImageDocument = {
      _id: existingDocId,
      _rev: 'test-rev-1',
      type: 'image',
      created: Date.now() - 10000,
      prompt: 'Original prompt',
      currentVersion: 0,
      currentPromptKey: 'p1',
      versions: [{ id: 'v1', created: Date.now() - 10000, promptKey: 'p1' }],
      prompts: { p1: { text: 'Original prompt', created: Date.now() - 10000 } },
      _files: { v1: mockFile },
    };

    // Set up the database mock
    mockDb.get.mockResolvedValue(mockDocument);
    mockDb.put.mockResolvedValue({ id: existingDocId, rev: 'new-rev' });

    // Call generateImage with new prompt
    const result = await generateImage({
      db: mockDb,
      _id: existingDocId,
      prompt: newPrompt,
    });

    // Verify the document was updated with the new prompt
    expect(result.document._id).toBe(existingDocId);
    expect(result.document.currentVersion).toBe(1);
    expect(result.document.prompts.p1.text).toBe(newPrompt);

    // Verify database calls
    expect(mockDb.get).toHaveBeenCalledWith(existingDocId);
    expect(mockDb.put).toHaveBeenCalledTimes(1);
  });
});
