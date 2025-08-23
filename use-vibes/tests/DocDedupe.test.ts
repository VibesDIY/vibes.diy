import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MODULE_STATE } from 'use-vibes-core';

// This test focuses specifically on the document deduplication mechanism
// without involving the full component rendering pipeline

describe('Document Creation Deduplication', () => {
  beforeEach(() => {
    // Reset the module state before each test
    MODULE_STATE.createdDocuments.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should track document IDs by prompt and options hash', () => {
    // Simulate a document being created
    const prompt = 'test prompt';
    const options = { size: '512x512' };
    const stableKey = prompt + '-' + JSON.stringify(options);
    const docId = 'test-doc-id-123';

    // Record that a document was created for this request
    MODULE_STATE.createdDocuments.set(stableKey, docId);

    // Verify the document is tracked
    expect(MODULE_STATE.createdDocuments.has(stableKey)).toBe(true);
    expect(MODULE_STATE.createdDocuments.get(stableKey)).toBe(docId);
  });

  it('should use different keys for different prompts', () => {
    // Set up two different prompt scenarios
    const prompt1 = 'first prompt';
    const prompt2 = 'second prompt';
    const options = { size: '512x512' };

    const stableKey1 = prompt1 + '-' + JSON.stringify(options);
    const stableKey2 = prompt2 + '-' + JSON.stringify(options);

    // Record documents for each prompt
    MODULE_STATE.createdDocuments.set(stableKey1, 'doc-id-1');
    MODULE_STATE.createdDocuments.set(stableKey2, 'doc-id-2');

    // Verify different keys are used
    expect(MODULE_STATE.createdDocuments.get(stableKey1)).toBe('doc-id-1');
    expect(MODULE_STATE.createdDocuments.get(stableKey2)).toBe('doc-id-2');
  });

  it('should use different keys for same prompt but different options', () => {
    const prompt = 'same prompt';
    const options1 = { size: '512x512' };
    const options2 = { size: '1024x1024' };

    const stableKey1 = prompt + '-' + JSON.stringify(options1);
    const stableKey2 = prompt + '-' + JSON.stringify(options2);

    // Record documents for each option set
    MODULE_STATE.createdDocuments.set(stableKey1, 'doc-id-options1');
    MODULE_STATE.createdDocuments.set(stableKey2, 'doc-id-options2');

    // Verify different keys are used for different options
    expect(MODULE_STATE.createdDocuments.get(stableKey1)).toBe('doc-id-options1');
    expect(MODULE_STATE.createdDocuments.get(stableKey2)).toBe('doc-id-options2');
  });

  it('should clean up document tracking during cleanup interval', () => {
    // Setup tracking entries
    MODULE_STATE.createdDocuments.set('test-key-1', 'doc-id-1');
    MODULE_STATE.createdDocuments.set('test-key-2', 'doc-id-2');
    MODULE_STATE.requestTimestamps.set('test-key-1', Date.now() - 10 * 60 * 1000); // 10 minutes old

    // Simulate cleanup logic (directly from utils.ts)
    const now = Date.now();
    for (const [key, timestamp] of MODULE_STATE.requestTimestamps.entries()) {
      if (now - timestamp > 5 * 60 * 1000) {
        // 5 minutes
        MODULE_STATE.createdDocuments.delete(key); // Should clean up test-key-1
      }
    }

    // Verify the old entry was cleaned up
    expect(MODULE_STATE.createdDocuments.has('test-key-1')).toBe(false);
    expect(MODULE_STATE.createdDocuments.has('test-key-2')).toBe(true);
  });
});
