import { describe, it, expect } from 'vitest';
import { getImgGenMode } from '../base/components/ImgGenUtils/ImgGenModeUtils.js';
import type { PartialImageDocument } from '@vibes.diy/use-vibes-base';

describe('ImgGenModeUtils', () => {
  describe('getImgGenMode', () => {
    // Test data helpers
    const createDocument = (
      overrides: Partial<PartialImageDocument> = {}
    ): PartialImageDocument => ({
      _id: 'test-doc-id',
      type: 'image',
      _files: {},
      ...overrides,
    });

    const createDocumentWithVersions = (count = 1): PartialImageDocument => ({
      ...createDocument(),
      versions: Array(count)
        .fill(null)
        .map((_, i) => ({
          id: `v${i + 1}`,
          created: Date.now() + i,
          promptKey: `p${i + 1}`,
        })),
    });

    const createDocumentWithPrompt = (prompt: string): PartialImageDocument => ({
      ...createDocument(),
      prompt,
    });

    describe('Error handling', () => {
      it('should return error mode when error is present', () => {
        const mode = getImgGenMode({
          document: null,
          prompt: undefined,
          loading: false,
          error: new Error('Test error'),
        });
        expect(mode).toBe('error');
      });
    });

    describe('First generation scenarios (no versions)', () => {
      it('should return generating mode for direct prompt + loading + no versions', () => {
        const mode = getImgGenMode({
          document: createDocument(),
          prompt: 'test prompt',
          loading: true,
          error: undefined,
        });
        expect(mode).toBe('generating');
      });

      it('should return generating mode for document prompt + loading + no versions', () => {
        const document = createDocumentWithPrompt('document prompt');
        const mode = getImgGenMode({
          document,
          prompt: undefined, // No direct prompt
          loading: true,
          error: undefined,
        });
        expect(mode).toBe('generating');
      });

      it('should return generating mode for structured document prompt + loading + no versions', () => {
        const document = createDocument({
          prompts: {
            p123: { text: 'structured prompt', created: Date.now() },
          },
          currentPromptKey: 'p123',
        });
        const mode = getImgGenMode({
          document,
          prompt: undefined, // No direct prompt
          loading: true,
          error: undefined,
        });
        expect(mode).toBe('generating');
      });

      it('should return placeholder mode when no prompt and not loading', () => {
        const mode = getImgGenMode({
          document: createDocument(),
          prompt: undefined,
          loading: false,
          error: undefined,
        });
        expect(mode).toBe('placeholder');
      });
    });

    describe('Modal regeneration scenarios (has versions)', () => {
      it('should return display mode when has versions, even during loading', () => {
        const document = createDocumentWithVersions(1);
        const mode = getImgGenMode({
          document,
          prompt: 'regenerate prompt', // Direct prompt provided
          loading: true, // Currently regenerating
          error: undefined,
        });
        expect(mode).toBe('display');
      });

      it('should return display mode when has versions with document prompt + loading', () => {
        const document = {
          ...createDocumentWithVersions(1),
          prompt: 'existing prompt',
        };
        const mode = getImgGenMode({
          document,
          prompt: undefined, // No direct prompt
          loading: true, // Currently regenerating
          error: undefined,
        });
        expect(mode).toBe('display');
      });

      it('should return display mode when has versions and not loading', () => {
        const document = createDocumentWithVersions(1);
        const mode = getImgGenMode({
          document,
          prompt: undefined,
          loading: false,
          error: undefined,
        });
        expect(mode).toBe('display');
      });
    });

    describe('Upload scenarios', () => {
      it('should return uploadWaiting mode when has input files but no prompt and no versions', () => {
        const document = createDocument({
          _files: {
            'in-file1': new File(['test'], 'test.jpg', { type: 'image/jpeg' }),
          },
        });
        const mode = getImgGenMode({
          document,
          prompt: undefined,
          loading: false,
          error: undefined,
        });
        expect(mode).toBe('uploadWaiting');
      });
    });

    describe('Edge cases', () => {
      it('should return placeholder mode when no document', () => {
        const mode = getImgGenMode({
          document: null,
          prompt: undefined,
          loading: false,
          error: undefined,
        });
        expect(mode).toBe('placeholder');
      });

      it('should return placeholder mode when document exists but has no files or versions', () => {
        const mode = getImgGenMode({
          document: createDocument(),
          prompt: undefined,
          loading: false,
          error: undefined,
        });
        expect(mode).toBe('placeholder');
      });
    });

    describe('Priority ordering verification', () => {
      it('should prioritize display mode over generating mode when has versions', () => {
        // This test verifies the fix for modal regeneration
        const document = createDocumentWithVersions(1);
        const mode = getImgGenMode({
          document,
          prompt: 'new prompt', // Direct prompt
          loading: true, // Loading
          error: undefined,
        });
        // Should be display mode, NOT generating mode
        expect(mode).toBe('display');
      });

      it('should allow generating mode when no versions exist', () => {
        // This test verifies first generation still works
        const document = createDocument();
        const mode = getImgGenMode({
          document,
          prompt: 'first prompt',
          loading: true,
          error: undefined,
        });
        // Should be generating mode since no versions exist
        expect(mode).toBe('generating');
      });
    });

    describe('Debug mode', () => {
      it('should work the same with debug enabled', () => {
        const document = createDocumentWithVersions(1);
        const mode = getImgGenMode({
          document,
          prompt: 'test prompt',
          loading: true,
          error: undefined,
          debug: false, // Test logic without console noise
        });
        expect(mode).toBe('display');
      });
    });
  });
});
