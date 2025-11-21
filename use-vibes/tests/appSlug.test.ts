import { describe, it, expect } from 'vitest';

// Import the utilities from the actual implementation to test them directly
import * as appSlugModule from '../base/utils/appSlug.js';

describe('App Slug Utilities', () => {
  describe('getAppSlug', () => {
    it('should be exported from the module', () => {
      expect(typeof appSlugModule.getAppSlug).toBe('function');
    });
  });

  describe('getFullAppIdentifier', () => {
    it('should be exported from the module', () => {
      expect(typeof appSlugModule.getFullAppIdentifier).toBe('function');
    });
  });

  describe('isDevelopmentEnvironment', () => {
    it('should be exported from the module', () => {
      expect(typeof appSlugModule.isDevelopmentEnvironment).toBe('function');
    });
  });

  describe('isProductionEnvironment', () => {
    it('should be exported from the module', () => {
      expect(typeof appSlugModule.isProductionEnvironment).toBe('function');
    });
  });

  describe('Integration with base index', () => {
    it('should export all functions from base index', async () => {
      const baseModule = await import('@vibes.diy/use-vibes-base');
      expect(typeof baseModule.getAppSlug).toBe('function');
      expect(typeof baseModule.getFullAppIdentifier).toBe('function');
      expect(typeof baseModule.isDevelopmentEnvironment).toBe('function');
      expect(typeof baseModule.isProductionEnvironment).toBe('function');
      expect(typeof baseModule.generateRandomInstanceId).toBe('function');
      expect(typeof baseModule.generateFreshDataUrl).toBe('function');
      expect(typeof baseModule.generateRemixUrl).toBe('function');
    });
  });

  describe('Basic functionality test', () => {
    it('should throw error for unknown environment (not /vibe/ path)', () => {
      // New behavior: getAppSlug throws if not on a /vibe/ path
      expect(() => appSlugModule.getAppSlug()).toThrow('Unable to determine app slug from URL');
    });

    it('should generate random instance IDs', () => {
      const id1 = appSlugModule.generateRandomInstanceId();
      const id2 = appSlugModule.generateRandomInstanceId();

      // Should generate different IDs
      expect(id1).not.toBe(id2);

      // Should be reasonable length (cement's nextId generates variable-length IDs)
      expect(id1.length).toBeGreaterThanOrEqual(8);
      expect(id1.length).toBeLessThanOrEqual(16);
      expect(id2.length).toBeGreaterThanOrEqual(8);
      expect(id2.length).toBeLessThanOrEqual(16);

      // Should only contain alphanumeric characters
      expect(id1).toMatch(/^[a-zA-Z0-9]+$/);
      expect(id2).toMatch(/^[a-zA-Z0-9]+$/);
    });

    // Note: Tests for getAppSlug(), getInstanceId(), generateFreshDataUrl(), and generateRemixUrl()
    // with path-based URLs are not included here because mocking window.location in browser
    // environment is not reliable. These functions are tested through integration tests and
    // real usage in the vibes.diy application.
  });
});
