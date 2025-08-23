import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { addNewVersion, ImageDocument } from 'use-vibes-core';
import { DocWithId } from 'use-fireproof';
import { fail } from 'assert';

// Mock for database operations
const mockDb = {
  get: vi.fn(),
  put: vi.fn(),
  remove: vi.fn(),
  query: vi.fn(),
  getAttachment: vi.fn(),
  putAttachment: vi.fn(),
};

// Create a mock File
const mockFile = new File(['test content'], 'test-image.png', { type: 'image/png' });

// Mock the call-ai module
vi.mock('call-ai', () => ({
  imageGen: vi.fn().mockImplementation(async () => ({
    created: Date.now(),
    data: [{ b64_json: 'test-base64-data' }],
  })),
  callAI: vi.fn().mockImplementation(async () => 'Mocked text response'),
}));

// Mock the regenerateImage function (this is what the refresh button uses)
const regenerateImage = vi.fn(async ({ db, _id, _prompt }) => {
  // Get the document
  const doc = await db.get(_id);

  // Add a new version
  const updatedDoc = addNewVersion(doc, mockFile);

  // Save to the database
  await db.put(updatedDoc);

  // Return the result
  return {
    document: { ...updatedDoc, _rev: 'new-rev' },
    file: mockFile,
  };
});

// Mock the generateImage function for creating images with new prompts
const generateImage = vi.fn(async ({ db, _id, prompt }) => {
  let doc;

  if (_id) {
    // Get existing document if ID is provided
    doc = await db.get(_id);

    // Add new version with new prompt
    const updatedDoc = addNewVersion(doc, mockFile, prompt);
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

// Mock the use-image-gen module
vi.mock('../src/hooks/image-gen/use-image-gen', () => ({
  regenerateImage,
  generateImage,
}));

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
      created: Date.now(),
      prompt: 'Original test prompt',
      currentVersion: 0,
      currentPromptKey: 'p1',
      versions: [{ id: 'v1', created: Date.now() - 1000, promptKey: 'p1' }],
      prompts: {
        p1: { text: 'Original test prompt', created: Date.now() - 1000 },
      },
      _files: {
        v1: mockFile,
      },
    };

    // Set up the database mock to return our test document
    mockDb.get.mockResolvedValue(mockDocument);
    mockDb.put.mockResolvedValue({ ...mockDocument, _rev: 'new-rev' });

    // Call regenerateImage (the function that's called when refresh button is clicked)
    await regenerateImage({
      db: mockDb,
      _id: existingDocId,
      prompt: mockDocument.prompt,
    });

    // Verify that the document was fetched from the database
    expect(mockDb.get).toHaveBeenCalledWith(existingDocId);

    // Verify that the database.put was called to save the updated document
    expect(mockDb.put).toHaveBeenCalled();

    // Get the document that was passed to put
    const updatedDoc = mockDb.put.mock.calls[0][0];

    // Verify that the document ID was preserved (not creating a new document)
    expect(updatedDoc._id).toBe(existingDocId);

    // Verify that a new version was added
    expect(updatedDoc.versions?.length).toBe(2);

    // Verify that the current version was updated to point to the new version
    expect(updatedDoc.currentVersion).toBe(1); // 0-indexed, so 1 is the second version
  });

  it('should preserve document ID when creating multiple versions', async () => {
    // Create a mock document with one initial version
    const existingDocId = 'multi-version-test-id';
    const originalDoc: ImageDocument = {
      _id: existingDocId,
      _rev: 'test-rev-1',
      type: 'image',
      created: Date.now(),
      prompt: 'Original test prompt',
      currentVersion: 0,
      currentPromptKey: 'p1',
      versions: [{ id: 'v1', created: Date.now() - 3000, promptKey: 'p1' }],
      prompts: {
        p1: { text: 'Original test prompt', created: Date.now() - 3000 },
      },
      _files: {
        v1: mockFile,
      },
    };

    // Set up a variable to track the updated document across regenerations
    let updatedDoc = { ...originalDoc };

    // Configure mocks
    mockDb.get.mockImplementation(() => Promise.resolve(updatedDoc));
    mockDb.put.mockImplementation((doc) => {
      updatedDoc = { ...doc, _rev: 'new-rev-' + Math.random() };
      return Promise.resolve(updatedDoc);
    });

    // Call regenerateImage three times to simulate refreshing multiple times
    for (let i = 0; i < 3; i++) {
      await regenerateImage({
        db: mockDb,
        _id: existingDocId,
        prompt: originalDoc.prompt,
      });
    }

    // Verify that the document ID was preserved across all regenerations
    expect(updatedDoc._id).toBe(existingDocId);

    // Check that we now have 4 versions (the original + 3 new ones)
    expect(updatedDoc.versions?.length).toBe(4);

    // Check that the version IDs are sequential
    expect(updatedDoc.versions?.map((v) => v.id)).toEqual(['v1', 'v2', 'v3', 'v4']);

    // Check that the current version is set to the latest version (index 3, which is v4)
    expect(updatedDoc.currentVersion).toBe(3);
  });

  it('should support creating a new version with a different prompt', async () => {
    // Document with an existing prompt
    const existingDocId = 'prompt-test-id';
    const initialPrompt = 'Initial test prompt';
    const newPrompt = 'Updated test prompt';

    // Create a mock document with the initial prompt
    const mockDocument: ImageDocument = {
      _id: existingDocId,
      _rev: 'test-rev-1',
      type: 'image',
      created: Date.now(),
      prompt: initialPrompt,
      currentVersion: 0,
      currentPromptKey: 'p1',
      versions: [{ id: 'v1', created: Date.now() - 1000, promptKey: 'p1' }],
      prompts: {
        p1: { text: initialPrompt, created: Date.now() - 1000 },
      },
      _files: {
        v1: mockFile,
      },
    };

    // Set up the database mocks
    mockDb.get.mockResolvedValue(mockDocument);
    let updatedDoc: DocWithId<ImageDocument> | null = null;
    mockDb.put.mockImplementation((doc) => {
      updatedDoc = { ...doc, _rev: 'new-rev' };
      return Promise.resolve(updatedDoc);
    });

    // Generate a new image version with a different prompt
    await generateImage({
      db: mockDb,
      _id: existingDocId,
      prompt: newPrompt,
    });
    if (!updatedDoc) {
      fail('Updated doc is null');
      return;
    }
    updatedDoc = updatedDoc as DocWithId<ImageDocument>;

    // Verify that the document was updated correctly
    expect(updatedDoc._id).toBe(existingDocId);
    expect(updatedDoc.versions?.length).toBe(2);
    expect(updatedDoc.currentVersion).toBe(1);

    // Check that the new prompt was added to the document
    expect(updatedDoc.prompts?.p2).toBeDefined();
    expect(updatedDoc.prompts?.p2.text).toBe(newPrompt);
    expect(updatedDoc.currentPromptKey).toBe('p2');

    // Check that the new version has a file attached
    expect(updatedDoc._files?.v2).toBeDefined();
  });
});
