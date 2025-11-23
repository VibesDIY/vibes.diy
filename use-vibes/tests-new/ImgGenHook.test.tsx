import React, { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImgGen } from 'use-vibes';
import { imageGen } from 'call-ai';

// Define mock modules first (these are hoisted to the top by Vitest)
vi.mock('call-ai', () => {
  return {
    imageGen: vi.fn().mockImplementation((prompt, options) => {
      return Promise.resolve({
        created: Date.now(),
        data: [
          {
            b64_json: 'mockBase64Image',
            url: null,
            revised_prompt: 'Generated test image',
          },
        ],
      });
    }),
    callAI: vi.fn(),
  };
});

// Mock Fireproof
vi.mock('use-fireproof', () => {
  return {
    useFireproof: () => ({
      database: {
        get: vi.fn().mockRejectedValue(new Error('Not found')),
        put: vi.fn().mockResolvedValue({ ok: true }),
        del: vi.fn().mockResolvedValue({ ok: true }),
      },
    }),
    ImgFile: ({ alt }: { alt?: string }) => <div data-testid="mock-img">{alt}</div>,
  };
});

// Import the mocked module after the vi.mock calls

// Cast the imported mocked function to include Vi mock methods
const mockImageGen = imageGen as unknown as ReturnType<typeof vi.fn>;

// Track the number of fetch calls across renders
describe('ImgGen Render Test', () => {
  beforeEach(() => {
    mockImageGen.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not trigger duplicate image generation requests', async () => {
    // Wrap in act to handle useEffect and state updates
    await act(async () => {
      render(<ImgGen prompt="test image" />);
    });

    // Wait a bit to ensure any effects have run
    await new Promise((r) => setTimeout(r, 100));

    // Check how many times imageGen was called

    // This should be 1, but the bug might show 2 or more
    expect(mockImageGen).toHaveBeenCalledTimes(1);
  });

  it('should only generate new image when props change', async () => {
    // Test component that can change props
    function TestWrapper() {
      const [prompt, setPrompt] = useState('initial prompt');

      return (
        <div>
          <ImgGen prompt={prompt} />
          <button data-testid="change-prompt" onClick={() => setPrompt('new prompt')}>
            Change Prompt
          </button>
        </div>
      );
    }

    await act(async () => {
      render(<TestWrapper />);
    });

    // Wait for initial render to complete
    await new Promise((r) => setTimeout(r, 100));

    // Check initial calls
    const initialCalls = mockImageGen.mock.calls.length;

    // Change the prompt
    await act(async () => {
      screen.getByTestId('change-prompt').click();
    });

    // Wait for effects to run
    await new Promise((r) => setTimeout(r, 100));

    // Should only have one additional call
    const finalCalls = mockImageGen.mock.calls.length;

    // We expect exactly one more call
    expect(finalCalls).toBe(initialCalls + 1);
  });
});
