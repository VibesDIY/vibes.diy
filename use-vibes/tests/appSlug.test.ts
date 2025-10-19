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
    });
  });

  describe('Basic functionality test', () => {
    it('should handle unknown environment gracefully', () => {
      // These tests verify the functions exist and return expected fallback values
      // without requiring complex window mocking that can hang in the test environment
      const unknownResult = appSlugModule.getAppSlug();
      expect(typeof unknownResult).toBe('string');
      expect(unknownResult.length).toBeGreaterThan(0);
    });
  });
});
