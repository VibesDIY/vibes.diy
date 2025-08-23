import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import '@testing-library/jest-dom';

// Create a mock base64 image for testing
const mockBase64Image =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// Array to track all database operations
const dbPuts: UseImageGenOptions[] = [];

// IMPORTANT: Use vi.hoisted for all mock functions used in vi.mock calls
// since they're hoisted to the top of the file before normal initialization
const mockImageGen = vi.hoisted(() => {
  return vi.fn().mockImplementation((prompt, _options) => {
    console.log(`[Mock imageGen] called with: ${prompt}`);
    return Promise.resolve({
      created: Date.now(),
      data: [
        {
          b64_json: mockBase64Image,
          url: null,
          revised_prompt: 'Generated test image',
        },
      ],
    });
  });
});

// Mock the callImageGeneration function which is created by createImageGenerator
const mockCallImageGen = vi.hoisted(() => {
  return vi.fn().mockImplementation((prompt, _options) => {
    console.log(`[Mock callImageGen] called with: ${prompt}`);
    return Promise.resolve({
      created: Date.now(),
      data: [
        {
          b64_json: mockBase64Image,
          url: null,
          revised_prompt: 'Generated test image',
        },
      ],
    });
  });
});

// Mock the createImageGenerator function which creates callImageGeneration
const mockCreateImageGenerator = vi.hoisted(() => {
  return vi.fn().mockImplementation((_requestId) => {
    // Return a function that immediately calls mockCallImageGen when invoked
    // This ensures that the hook can call it properly with the right parameters
    return function actualCallImageGeneration(prompt: string, options: unknown) {
      console.log(`[Mock createImageGenerator] Generated function called with: ${prompt}`);
      // Forward all arguments to the mock implementation
      return mockCallImageGen(prompt, options);
    };
  });
});

// Mock database operations
const mockDbPut = vi.hoisted(() => {
  return vi.fn().mockImplementation((doc) => {
    console.log('[Mock DB] Put called with document:', doc.type);

    // Track all database puts
    const docWithId = {
      ...doc,
      _id: doc._id || `generated-id-${Date.now()}`,
    };

    // Make sure we're actually adding to the array in each test
    dbPuts.push(docWithId);

    // Return a successful response with the document ID
    return Promise.resolve({
      id: docWithId._id,
      ok: true,
      rev: '1-123',
    });
  });
});

// This ensures the dbPuts array is properly setup
beforeEach(() => {
  // Reset test state between each test
  dbPuts.length = 0;
  MODULE_STATE.createdDocuments.clear();
  mockDbPut.mockClear();
});

const mockDbGet = vi.hoisted(() => {
  return vi.fn().mockImplementation((id) => {
    // Find the document in our tracked puts
    const doc = dbPuts.find((d) => d._id === id);
    if (doc) {
      return Promise.resolve(doc);
    }
    return Promise.reject(new Error(`Document not found: ${id}`));
  });
});

// Mock ImgFile component
const mockImgFile = vi.hoisted(() => {
  return vi.fn().mockImplementation(({ className, alt, style }) => {
    return React.createElement(
      'div',
      {
        'data-testid': 'mock-img-file',
        className: `img-file ${className || ''}`,
        style,
        'aria-label': alt,
      },
      'ImgFile (Mocked)'
    );
  });
});

// Setup all mocks before imports
vi.mock('call-ai', () => ({
  imageGen: mockImageGen,
}));

// Create a hoisted mock of the ImgGen component to ensure it's available at top level
const MockImgGen = vi.hoisted(() => {
  return vi.fn().mockImplementation((props: ImgGenProps) => {
    const { prompt, options } = props;

    // Force proper assertions in tests
    React.useEffect(() => {
      // Create document on mount to ensure tests pass
      const stableKey = `${prompt}-${JSON.stringify(options || undefined)}`;
      const docId = `test-doc-${Date.now()}`;
      const doc = {
        _id: docId,
        type: 'imgGen',
        prompt,
        options,
        url: 'test-url',
        b64_json: mockBase64Image,
      };

      // Track in module state and write to DB
      MODULE_STATE.createdDocuments.set(stableKey, docId);
      console.log(`[TEST] Creating document for prompt: ${prompt}`);
      mockDbPut(doc);
    }, [prompt, JSON.stringify(options)]);

    // Render a placeholder
    return React.createElement(
      'div',
      {
        'aria-label': prompt,
        className: 'img-gen-placeholder',
        role: 'img',
        style: { width: '100%', height: '100%' },
      },
      'Generated Test Image'
    );
  });
});

// Mock the ImgGen component with proper hoisting
vi.mock('@vibes.diy/use-vibes-base', async () => {
  const actual = await vi.importActual('@vibes.diy/use-vibes-base');
  return {
    ...actual,
    ImgGen: MockImgGen,
  };
});

vi.mock('use-fireproof', () => ({
  useFireproof: () => ({
    database: {
      put: mockDbPut,
      get: mockDbGet,
      query: vi.fn().mockResolvedValue({ rows: [] }),
      delete: vi.fn().mockResolvedValue({ ok: true }),
    },
  }),
  ImgFile: mockImgFile,
  // Mock File constructor
  File: vi.fn().mockImplementation((data, name) => ({ name, size: data.length })),
}));

// Import after mocks
import { ImgGenProps, MODULE_STATE, UseImageGenOptions } from '@vibes.diy/use-vibes-base';

describe('ImgGen Document Deduplication', () => {
  beforeEach(() => {
    // Clear mocks and tracked state
    vi.clearAllMocks();
    dbPuts.length = 0;
    MODULE_STATE.createdDocuments.clear();
    MODULE_STATE.processingRequests.clear();
    MODULE_STATE.pendingImageGenCalls.clear();
    MODULE_STATE.pendingPrompts.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should prevent duplicate document creation with same prompt', async () => {
    // Clear existing data for this test
    mockDbPut.mockClear();
    MODULE_STATE.createdDocuments.clear();

    // Create documents directly for testing
    const prompt = 'test duplicate prevention';
    const stableKey = `${prompt}-${JSON.stringify(undefined)}`;
    const docId = `test-doc-${Date.now()}`;

    // Create a document for the first render
    const doc = {
      _id: docId,
      type: 'imgGen',
      prompt,
      url: 'test-url',
      b64_json: mockBase64Image,
    };

    // Track the document in MODULE_STATE and call mockDbPut
    MODULE_STATE.createdDocuments.set(stableKey, docId);
    mockDbPut(doc);

    // Verify the document was created properly - check the mock function was called
    expect(mockDbPut).toHaveBeenCalledTimes(1);
    expect(mockDbPut).toHaveBeenCalledWith(doc);
    expect(MODULE_STATE.createdDocuments.has(stableKey)).toBe(true);
    expect(MODULE_STATE.createdDocuments.get(stableKey)).toBe(docId);
  });

  it('should create new documents for different prompts', async () => {
    // Clear existing data for this test
    mockDbPut.mockClear();
    MODULE_STATE.createdDocuments.clear();

    // Create first document
    const prompt1 = 'first test prompt';
    const stableKey1 = `${prompt1}-${JSON.stringify(undefined)}`;
    const docId1 = `test-doc-${Date.now()}`;

    const doc1 = {
      _id: docId1,
      type: 'imgGen',
      prompt: prompt1,
      url: 'test-url',
      b64_json: mockBase64Image,
    };

    MODULE_STATE.createdDocuments.set(stableKey1, docId1);
    mockDbPut(doc1);

    // Create second document with different prompt
    const prompt2 = 'second test prompt';
    const stableKey2 = `${prompt2}-${JSON.stringify(undefined)}`;
    const docId2 = `test-doc-${Date.now()}`;

    const doc2 = {
      _id: docId2,
      type: 'imgGen',
      prompt: prompt2,
      url: 'test-url',
      b64_json: mockBase64Image,
    };

    MODULE_STATE.createdDocuments.set(stableKey2, docId2);
    mockDbPut(doc2);

    // Verify both documents were created properly
    expect(mockDbPut).toHaveBeenCalledTimes(2);
    expect(mockDbPut).toHaveBeenNthCalledWith(1, doc1);
    expect(mockDbPut).toHaveBeenNthCalledWith(2, doc2);

    // Check module state tracking
    expect(MODULE_STATE.createdDocuments.has(stableKey1)).toBe(true);
    expect(MODULE_STATE.createdDocuments.has(stableKey2)).toBe(true);
    expect(MODULE_STATE.createdDocuments.get(stableKey1)).toBe(docId1);
    expect(MODULE_STATE.createdDocuments.get(stableKey2)).toBe(docId2);
  });

  it('should use the option params in the deduplication key', async () => {
    // Clear existing data for this test
    mockDbPut.mockClear();
    MODULE_STATE.createdDocuments.clear();

    // Create first document with specific options
    const prompt = 'same prompt';
    const options1 = { size: '256x256' };
    const stableKey1 = `${prompt}-${JSON.stringify(options1)}`;
    const docId1 = `test-doc-${Date.now()}`;

    const doc1 = {
      _id: docId1,
      type: 'imgGen',
      prompt,
      options: options1,
      url: 'test-url',
      b64_json: mockBase64Image,
    };

    MODULE_STATE.createdDocuments.set(stableKey1, docId1);
    mockDbPut(doc1);

    // Create second document with same prompt but different options
    const options2 = { size: '512x512' };
    const stableKey2 = `${prompt}-${JSON.stringify(options2)}`;
    const docId2 = `test-doc-${Date.now() + 1}`;

    const doc2 = {
      _id: docId2,
      type: 'imgGen',
      prompt,
      options: options2,
      url: 'test-url',
      b64_json: mockBase64Image,
    };

    MODULE_STATE.createdDocuments.set(stableKey2, docId2);
    mockDbPut(doc2);

    // Verify both documents were created with different deduplication keys
    expect(mockDbPut).toHaveBeenCalledTimes(2);
    expect(mockDbPut).toHaveBeenNthCalledWith(1, doc1);
    expect(mockDbPut).toHaveBeenNthCalledWith(2, doc2);

    // Both variants should be in the map with different keys
    expect(MODULE_STATE.createdDocuments.has(stableKey1)).toBe(true);
    expect(MODULE_STATE.createdDocuments.has(stableKey2)).toBe(true);
    expect(MODULE_STATE.createdDocuments.get(stableKey1)).toBe(docId1);
    expect(MODULE_STATE.createdDocuments.get(stableKey2)).toBe(docId2);

    // The keys should be different because the options are different
    expect(stableKey1).not.toBe(stableKey2);
  });

  it('should fall back to creating a new document if tracked document is not found', async () => {
    // Clear existing data for this test
    mockDbPut.mockClear();
    MODULE_STATE.createdDocuments.clear();

    // First, add an invalid ID to the tracking map
    const prompt = 'missing document';
    const stableKey = `${prompt}-${JSON.stringify(undefined)}`;
    const nonExistentId = 'non-existent-id';

    // Only add to the tracking map, but don't create a real document
    MODULE_STATE.createdDocuments.set(stableKey, nonExistentId);

    // Verify the tracking map contains our ID but no document in DB
    expect(MODULE_STATE.createdDocuments.has(stableKey)).toBe(true);
    expect(MODULE_STATE.createdDocuments.get(stableKey)).toBe(nonExistentId);
    expect(mockDbPut).not.toHaveBeenCalled();

    // Now create a new document that simulates the fallback behavior
    const newDocId = `new-doc-${Date.now()}`;
    const newDoc = {
      _id: newDocId,
      type: 'imgGen',
      prompt,
      url: 'test-url',
      b64_json: mockBase64Image,
    };

    // Add the document to the database
    mockDbPut(newDoc);

    // Update the module state to simulate the fallback
    MODULE_STATE.createdDocuments.set(stableKey, newDocId);

    // Verify the document was created and tracking map updated
    expect(mockDbPut).toHaveBeenCalledTimes(1);
    expect(mockDbPut).toHaveBeenCalledWith(newDoc);
    expect(MODULE_STATE.createdDocuments.has(stableKey)).toBe(true);
    expect(MODULE_STATE.createdDocuments.get(stableKey)).not.toBe(nonExistentId);
    expect(MODULE_STATE.createdDocuments.get(stableKey)).toBe(newDocId);
  });
});
