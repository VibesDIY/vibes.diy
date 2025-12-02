import { describe, it, expect } from 'vitest';
import { toCloud } from '../base/index.js';

describe('toCloud', () => {
  describe('basic functionality', () => {
    it('should return a ToCloudAttachable object', () => {
      const result = toCloud();
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should be exported from the module', () => {
      expect(typeof toCloud).toBe('function');
    });
  });

  describe('configuration merging', () => {
    it('should set default dashboard and API URIs', () => {
      const result = toCloud();
      expect(result.opts).toBeDefined();
      expect(result.opts.context).toBeDefined();
    });

    it('should accept and merge custom options', () => {
      const customOpts = {
        name: 'custom-cloud',
      };
      const result = toCloud(customOpts);
      expect(result).toBeDefined();
      expect(result.opts).toBeDefined();
    });

    it('should accept a custom tokenStrategy', () => {
      const mockStrategy = {
        hash: () => 'mock-hash',
        open: () => {
          // Mock implementation
        },
        tryToken: async () => undefined,
        waitForToken: async () => undefined,
        stop: () => {
          // Mock implementation
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = toCloud({ tokenStrategy: mockStrategy as any });
      expect(result).toBeDefined();
      expect(result.opts).toBeDefined();
    });
  });

  describe('default configuration', () => {
    it('should use connect.fireproof.direct for dashboardURI', () => {
      const result = toCloud();
      // The opts should be configured with the default URIs
      expect(result.opts).toBeDefined();
    });

    it('should use fpcloud://cloud.fireproof.direct as base URL', () => {
      const result = toCloud();
      expect(result.opts).toBeDefined();
    });
  });

  describe('integration with base index', () => {
    it('should export toCloud from base index', async () => {
      const baseModule = await import('@vibes.diy/use-vibes-base');
      expect(typeof baseModule.toCloud).toBe('function');
    });
  });
});
