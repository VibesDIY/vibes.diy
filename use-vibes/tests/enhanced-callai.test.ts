/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the original call-ai module
vi.mock('call-ai', () => {
  const mockCallAI = vi.fn();
  return {
    callAI: mockCallAI,
    // Mock other exports as needed
    CallAIOptions: {},
    Message: {},
    StreamResponse: {},
  };
});

// Import after mocking
import { callAI } from '../base/enhanced-callai.js';
import { callAI as mockCallAI } from 'call-ai';

// Cast to mock function
const mockCallAIFn = mockCallAI as ReturnType<typeof vi.fn>;

describe('Enhanced callAI', () => {
  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks();

    // Clear localStorage
    localStorage.clear();

    // Mock successful response
    mockCallAIFn.mockResolvedValue('Mock AI response');
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Authentication header injection', () => {
    it('should include X-VIBES-Token header when auth token is available', async () => {
      // Set auth token in localStorage
      localStorage.setItem('auth_token', 'test-auth-token');

      // Call the enhanced callAI
      await callAI('test prompt', {
        apiKey: 'test-key',
        model: 'test-model',
      });

      // Verify the original callAI was called with enhanced headers
      expect(mockCallAIFn).toHaveBeenCalledWith('test prompt', {
        apiKey: 'test-key',
        model: 'test-model',
        headers: {
          'X-VIBES-Token': 'test-auth-token',
        },
      });
    });

    it('should not include X-VIBES-Token header when no auth token is available', async () => {
      // Ensure no auth token in localStorage
      localStorage.removeItem('auth_token');

      // Call the enhanced callAI
      await callAI('test prompt', {
        apiKey: 'test-key',
        model: 'test-model',
      });

      // Verify the original callAI was called without X-VIBES-Token
      expect(mockCallAIFn).toHaveBeenCalledWith('test prompt', {
        apiKey: 'test-key',
        model: 'test-model',
        headers: {},
      });
    });

    it('should preserve existing headers while adding X-VIBES-Token', async () => {
      // Set auth token in localStorage
      localStorage.setItem('auth_token', 'test-auth-token');

      // Call with existing headers
      await callAI('test prompt', {
        apiKey: 'test-key',
        headers: {
          'Content-Type': 'application/json',
          'Custom-Header': 'custom-value',
        },
      });

      // Verify existing headers are preserved and X-VIBES-Token is added
      expect(mockCallAIFn).toHaveBeenCalledWith('test prompt', {
        apiKey: 'test-key',
        headers: {
          'Content-Type': 'application/json',
          'Custom-Header': 'custom-value',
          'X-VIBES-Token': 'test-auth-token',
        },
      });
    });

    it('should handle localStorage access errors gracefully', async () => {
      // Mock localStorage to throw an error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn().mockImplementation(() => {
        throw new Error('localStorage access denied');
      });

      // Spy on console.warn
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Empty implementation to suppress warnings during test
      });

      try {
        // Call the enhanced callAI
        await callAI('test prompt', { apiKey: 'test-key' });

        // Verify warning was logged
        expect(consoleSpy).toHaveBeenCalledWith(
          '[enhanced-callAI] Could not access localStorage for auth token:',
          expect.any(Error)
        );

        // Verify the original callAI was called without X-VIBES-Token
        expect(mockCallAIFn).toHaveBeenCalledWith('test prompt', {
          apiKey: 'test-key',
          headers: {},
        });
      } finally {
        // Restore original localStorage.getItem
        localStorage.getItem = originalGetItem;
        consoleSpy.mockRestore();
      }
    });
  });

  describe('Message array support', () => {
    it('should work with message arrays', async () => {
      localStorage.setItem('auth_token', 'test-token');

      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      await callAI(messages, { model: 'test-model' });

      expect(mockCallAIFn).toHaveBeenCalledWith(messages, {
        model: 'test-model',
        headers: {
          'X-VIBES-Token': 'test-token',
        },
      });
    });
  });

  describe('Options forwarding', () => {
    it('should forward all options to the original callAI', async () => {
      localStorage.setItem('auth_token', 'test-token');

      const options = {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        stream: true,
        debug: true,
        customOption: 'custom-value',
      };

      await callAI('test prompt', options);

      expect(mockCallAIFn).toHaveBeenCalledWith('test prompt', {
        ...options,
        headers: {
          'X-VIBES-Token': 'test-token',
        },
      });
    });

    it('should work with no options provided', async () => {
      localStorage.setItem('auth_token', 'test-token');

      await callAI('test prompt');

      expect(mockCallAIFn).toHaveBeenCalledWith('test prompt', {
        headers: {
          'X-VIBES-Token': 'test-token',
        },
      });
    });
  });

  describe('Return value forwarding', () => {
    it('should return the result from original callAI', async () => {
      const mockResponse = 'AI generated response';
      mockCallAIFn.mockResolvedValue(mockResponse);

      const result = await callAI('test prompt');

      expect(result).toBe(mockResponse);
    });

    it('should forward streaming responses', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: vi.fn(),
      };
      mockCallAIFn.mockResolvedValue(mockStream);

      const result = await callAI('test prompt', { stream: true });

      expect(result).toBe(mockStream);
    });

    it('should forward errors from original callAI', async () => {
      const mockError = new Error('API error');
      mockCallAIFn.mockRejectedValue(mockError);

      await expect(callAI('test prompt')).rejects.toThrow('API error');
    });
  });

  describe('Browser environment compatibility', () => {
    it('should work in browser environments with window defined', async () => {
      // Verify window exists in browser test environment
      expect(typeof window).toBe('object');

      await callAI('test prompt', { apiKey: 'test-key' });

      // Verify the function works normally in browser environment
      expect(mockCallAIFn).toHaveBeenCalledWith('test prompt', {
        apiKey: 'test-key',
        headers: {},
      });
    });
  });
});
