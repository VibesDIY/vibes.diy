import { describe, it, expect } from 'vitest';
import { toCloud } from '../base/index.js';

describe('toCloud', () => {
  describe('basic functionality', () => {
    it('returns a ToCloudAttachable with opts', () => {
      const result = toCloud();
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.opts).toBeDefined();
    });

    it('is exported from the base module', () => {
      expect(typeof toCloud).toBe('function');
    });
  });

  describe('configuration merging', () => {
    it('applies default URIs and base URL', () => {
      const result = toCloud();

      const opts = result.opts as unknown as {
        dashboardURI?: string;
        tokenApiURI?: string;
      };

      expect(opts.dashboardURI).toBe('https://connect.fireproof.direct/fp/cloud/api/token-auto');
      expect(opts.tokenApiURI).toBe('https://connect.fireproof.direct/api');
      expect(result.opts.urls.car?.toString()).toBe('fpcloud://cloud.fireproof.direct/');
      expect(result.opts.urls.file?.toString()).toBe('fpcloud://cloud.fireproof.direct/');
      expect(result.opts.urls.meta?.toString()).toBe('fpcloud://cloud.fireproof.direct/');
    });

    it('merges custom options like name', () => {
      const customOpts = {
        name: 'custom-cloud',
      };
      const result = toCloud(customOpts);
      expect(result.opts.name).toBe('custom-cloud');
    });

    it('forwards tokenStrategy as strategy', () => {
      const mockStrategy = {
        hash: () => 'mock-hash',
        open: () => undefined,
        tryToken: async () => undefined,
        waitForToken: async () => undefined,
        stop: () => undefined,
      };

      const result = toCloud({
        tokenStrategy: mockStrategy,
      } as Parameters<typeof toCloud>[0]);
      expect(result.opts.strategy).toBe(mockStrategy);
    });
  });

  describe('option validation', () => {
    it('throws if both strategy and tokenStrategy are provided', () => {
      const mockStrategy = {
        hash: () => 'mock-hash',
        open: () => undefined,
        tryToken: async () => undefined,
        waitForToken: async () => undefined,
        stop: () => undefined,
      };

      expect(() =>
        toCloud({
          strategy: mockStrategy,
          tokenStrategy: mockStrategy,
        } as Parameters<typeof toCloud>[0])
      ).toThrowError(/provide either 'strategy' or 'tokenStrategy'/);
    });
  });

  describe('integration with base index', () => {
    it('exports toCloud from @vibes.diy/use-vibes-base', async () => {
      const baseModule = await import('@vibes.diy/use-vibes-base');
      expect(typeof baseModule.toCloud).toBe('function');
    });
  });
});
