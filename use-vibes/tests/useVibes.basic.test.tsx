import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mocks are available at the top level
const { mockMakeBaseSystemPrompt, mockCallAI } = vi.hoisted(() => ({
  mockMakeBaseSystemPrompt: vi.fn().mockResolvedValue({
    systemPrompt:
      "You are a React component generator. Generate a complete React component based on the user's prompt. Use Fireproof for data persistence.",
    dependencies: ['useFireproof'],
    instructionalText: true,
    demoData: false,
    model: 'anthropic/claude-sonnet-4',
  }),
  mockCallAI: vi.fn().mockImplementation((messages) => {
    // First call is for dependency selection (has catalog in system prompt)
    if (messages.some((m: { content?: string }) => m.content && m.content.includes('catalog'))) {
      return Promise.resolve(
        '{"selected": ["fireproof", "callai"], "instructionalText": true, "demoData": false}'
      );
    }
    // Second call is for component generation
    return Promise.resolve(
      'export default function TestComponent() { return <div>Test Component</div>; }'
    );
  }),
}));

vi.mock('@vibes.diy/prompts', () => ({
  makeBaseSystemPrompt: mockMakeBaseSystemPrompt,
  parseContent: vi.fn((text) => ({
    segments: [{ type: 'code', content: text }],
  })),
}));

vi.mock('call-ai', () => ({
  callAI: mockCallAI,
  callAi: mockCallAI,
  joinUrlParts: vi.fn((base: string, path: string) => {
    if (!base || !path) return base || path || '';
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${cleanBase}/${cleanPath}`;
  }),
  entriesHeaders: vi.fn(),
  callAiEnv: {},
}));

import { useVibes } from '../base/hooks/vibes-gen/use-vibes.js';

describe('useVibes - Basic Structure', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the mock implementation to ensure consistent behavior
    mockCallAI.mockImplementation((messages) => {
      // First call is for dependency selection (has catalog in system prompt)
      if (messages.some((m: { content?: string }) => m.content && m.content.includes('catalog'))) {
        return Promise.resolve(
          '{"selected": ["fireproof", "callai"], "instructionalText": true, "demoData": false}'
        );
      }
      // Second call is for component generation
      return Promise.resolve(
        'export default function TestComponent() { return <div>Test Component</div>; }'
      );
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should accept prompt string and optional options', () => {
    const { result } = renderHook(() =>
      useVibes('create a button', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.App).toBe(null);
    expect(result.current.code).toBe(null);
    expect(result.current.error).toBe(null);
    expect(result.current.progress).toBeGreaterThanOrEqual(0); // Progress simulation starts immediately
    expect(typeof result.current.regenerate).toBe('function');
  });

  it('should return App component after loading', async () => {
    mockCallAI.mockResolvedValue('export default function() { return <div>Test</div> }');

    const { result } = renderHook(() =>
      useVibes('create a button', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 10000,
      interval: 100,
    });

    expect(result.current.App).toBeDefined();
    expect(result.current.code).toContain('Test');
    expect(result.current.error).toBe(null);
  });

  it('should accept options as second parameter', async () => {
    mockCallAI.mockResolvedValue('export default function() { return <div>Form</div> }');

    const { result } = renderHook(() =>
      useVibes(
        'create a form',
        {
          database: 'custom-db',
          model: 'gpt-4',
          dependencies: ['useFireproof'],
        },
        mockCallAI
      )
    );

    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 10000,
      interval: 100,
    });
    expect(result.current.App).toBeDefined();
    expect(result.current.code).toContain('Form');
  });

  it('should handle empty prompt gracefully', () => {
    const { result } = renderHook(() =>
      useVibes('', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.App).toBe(null);
    expect(result.current.error?.message).toContain('Prompt required');
  });

  it('should handle undefined prompt gracefully', () => {
    const { result } = renderHook(() =>
      useVibes(undefined as unknown as string, { dependencies: ['useFireproof'] }, mockCallAI)
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.App).toBe(null);
    expect(result.current.error?.message).toContain('Prompt required');
  });

  it('should handle errors from AI service', async () => {
    mockCallAI.mockRejectedValue(new Error('Service unavailable'));

    const { result } = renderHook(() =>
      useVibes('create button', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    // Wait for loading to complete (error or success)
    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 10000,
      interval: 100,
    });

    // Check that error was set
    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe('Service unavailable');
    expect(result.current.App).toBe(null);
  });

  it('should handle skip option', () => {
    const { result } = renderHook(() => useVibes('create button', { skip: true }, mockCallAI));

    expect(result.current.loading).toBe(false);
    expect(result.current.App).toBe(null);
    expect(result.current.code).toBe(null);
    expect(result.current.error).toBe(null);
    expect(mockCallAI).not.toHaveBeenCalled();
  });

  it('should provide regenerate function', async () => {
    mockCallAI.mockResolvedValue('export default function() { return <div>Initial</div> }');

    const { result } = renderHook(() =>
      useVibes('create button', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 10000,
      interval: 100,
    });
    expect(result.current.code).toContain('Initial');

    // For now, just test that regenerate function exists and is callable
    // Full regeneration testing will be added in Cycle 2 with proper state management
    expect(typeof result.current.regenerate).toBe('function');
    result.current.regenerate(); // Should not throw
  });

  it('should show progress updates during generation', async () => {
    // Mock an immediate response to test progress (no need for actual delay in mocked test)
    mockCallAI.mockImplementation(() =>
      Promise.resolve('export default function() { return <div>Done</div> }')
    );

    const { result } = renderHook(() =>
      useVibes('create button', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    expect(result.current.progress).toBeGreaterThanOrEqual(0);
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 10000,
      interval: 100,
    });

    // Progress should reach 100 when loading is complete
    await waitFor(() => expect(result.current.progress).toBeGreaterThan(89), { timeout: 1000 });
  });

  it('should handle concurrent requests properly', async () => {
    mockCallAI.mockResolvedValue('export default function() { return <div>Button</div> }');

    const { result: result1 } = renderHook(() =>
      useVibes('create button', { dependencies: ['useFireproof'] }, mockCallAI)
    );
    const { result: result2 } = renderHook(() =>
      useVibes('create button', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    await waitFor(
      () => {
        expect(result1.current.loading).toBe(false);
        expect(result2.current.loading).toBe(false);
      },
      { timeout: 3000 }
    );

    expect(result1.current.App).toBeDefined();
    expect(result2.current.App).toBeDefined();
  });

  it('should verify system prompt generation and metadata', async () => {
    mockCallAI.mockResolvedValue('function App() { return <div>Test</div>; }');

    const { result } = renderHook(() =>
      useVibes('Create a todo app', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 10000,
      interval: 100,
    });

    // Since we provided dependencies, dependency selection is bypassed
    // We verify that callAI was called once for component generation
    expect(mockCallAI).toHaveBeenCalledTimes(1);

    // The call should be for component generation and contain the system prompt
    expect(mockCallAI).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('component'),
        }),
      ]),
      expect.any(Object)
    );

    // Verify that metadata is included in the document regardless of orchestrator vs fallback
    expect(result.current.document).toMatchObject({
      dependencies: expect.any(Array),
      aiSelectedDependencies: expect.any(Array),
      instructionalText: expect.any(Boolean),
      demoData: expect.any(Boolean),
      model: expect.any(String),
      timestamp: expect.any(Number),
    });

    // Verify the hook returned a working component
    expect(result.current.App).toBeDefined();
    expect(result.current.code).toContain('Test');
  });

  it('should not violate Rules of Hooks when transitioning between states', async () => {
    mockCallAI.mockResolvedValue('export default function() { return <div>Test</div> }');

    // Start with empty prompt
    const { result, rerender } = renderHook(
      ({ prompt, skip }) => useVibes(prompt, { skip, dependencies: ['useFireproof'] }, mockCallAI),
      {
        initialProps: { prompt: '', skip: false },
      }
    );

    // Should have error for empty prompt
    expect(result.current.loading).toBe(false);
    expect(result.current.error?.message).toContain('Prompt required');

    // Rerender with valid prompt - this should not cause hooks error
    rerender({ prompt: 'create button', skip: false });

    // Should start loading
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(null);

    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 10000,
      interval: 100,
    });

    expect(result.current.App).toBeDefined();
    expect(result.current.code).toContain('Test');

    // Rerender with skip option - should not cause hooks error
    rerender({ prompt: 'create button', skip: true });

    expect(result.current.loading).toBe(false);
    expect(result.current.App).toBe(null);
    expect(result.current.error).toBe(null);

    // Rerender back to normal - should not cause hooks error
    rerender({ prompt: 'create new button', skip: false });

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false), {
      timeout: 10000,
      interval: 100,
    });

    expect(result.current.App).toBeDefined();
  });
});
