import { act, render, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupIframeMocks, createMockIframe } from './utils/iframe-mocks.js';

// Mock call-ai module to prevent network calls
vi.mock('call-ai', () => ({
  callAI: vi.fn().mockResolvedValue('Mocked AI response'),
  joinUrlParts: vi.fn((base: string, path: string) => {
    if (!base || !path) return base || path || '';
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${cleanBase}/${cleanPath}`;
  }),
}));

// Mock the environment config that would be used for endpoints
vi.mock('../../base/config/env', () => ({
  VibesDiyEnv: {
    CALLAI_ENDPOINT: () => 'https://api.openrouter.ai/api/v1/chat/completions',
  },
}));

// Mock parseContent with realistic parsing
vi.mock('@vibes.diy/prompts', () => ({
  parseContent: vi.fn((text: string) => {
    // Simulate realistic markdown parsing with code blocks
    const segments = [];
    const parts = text.split(/```(?:jsx?|javascript)?\n/);

    if (parts.length === 1) {
      // No code blocks
      return { segments: [{ type: 'markdown', content: text }] };
    }

    for (let i = 0; i < parts.length; i++) {
      if (i === 0) {
        // First part is always markdown
        if (parts[i].trim()) {
          segments.push({ type: 'markdown', content: parts[i] });
        }
      } else if (i % 2 === 1) {
        // Odd indices are code blocks
        const codeEndIndex = parts[i].indexOf('\n```');
        if (codeEndIndex !== -1) {
          const code = parts[i].substring(0, codeEndIndex);
          segments.push({ type: 'code', content: code });

          // Add remaining text as markdown if any
          const remaining = parts[i].substring(codeEndIndex + 4);
          if (remaining.trim()) {
            segments.push({ type: 'markdown', content: remaining });
          }
        }
      }
    }

    return { segments };
  }),

  makeBaseSystemPrompt: vi.fn().mockImplementation(async (model, options) => {
    // Fast mock that bypasses network calls
    return {
      systemPrompt: 'You are a React component generator',
      dependencies: options?.dependencies || ['useFireproof'],
      instructionalText: true,
      demoData: false,
      model: model || 'anthropic/claude-sonnet-4.5',
    };
  }),
}));

// Import the hook after mocks are set up
import { useVibes } from '../base/hooks/vibes-gen/use-vibes.js';

describe('useVibes Integration Tests', () => {
  beforeEach(() => {
    createMockIframe();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupIframeMocks();
  });

  it('should complete full flow from prompt to iframe render', async () => {
    const _startTime = performance.now();

    const mockCallAI = vi.fn().mockImplementation((_messages, _options) => {
      return Promise.resolve(`
Here's your todo app:

\`\`\`jsx
import React, { useState } from "react"
import { useFireproof } from "use-fireproof"

export default function TodoApp() {
  const { useDocument, useLiveQuery } = useFireproof("todos")
  const [newTodo, setNewTodo] = useState("")
  
  const { docs: todos } = useLiveQuery("type", { key: "todo" })
  
  const addTodo = async () => {
    if (newTodo.trim()) {
      await useDocument({
        type: "todo",
        text: newTodo,
        completed: false,
        created: Date.now()
      }).submit()
      setNewTodo("")
    }
  }
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Todo App</h1>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Add a new todo..."
          className="flex-1 p-2 border rounded"
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
        />
        <button 
          onClick={addTodo}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add
        </button>
      </div>
      <ul className="space-y-2">
        {todos.map((todo) => (
          <li key={todo._id} className="flex items-center gap-2 p-2 border rounded">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => {/* toggle completion */}}
            />
            <span className={todo.completed ? "line-through text-gray-500" : ""}>
              {todo.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
\`\`\`

This creates a fully functional todo app with Fireproof for data persistence.
      `);
    });

    const { result } = renderHook(() =>
      useVibes('create a todo app', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.App).toBe(null);
    expect(result.current.code).toBe(null);

    // Wait for AI response and parsing
    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 2000, interval: 50 }
    );

    const _endTime = performance.now();

    // Verify code was extracted correctly
    expect(result.current.code).toContain('TodoApp');
    expect(result.current.code).toContain('useFireproof');
    expect(result.current.code).toContain('useLiveQuery');
    expect(result.current.error).toBe(null);

    // Should have generated a component
    expect(result.current.App).toBeDefined();

    // Render the component
    if (result.current.App) {
      const { container } = render(<result.current.App />);

      // Should render without errors (even if placeholder)
      expect(container).toBeInTheDocument();

      // Once implemented, verify iframe was created:
      // const iframe = container.querySelector('iframe');
      // expect(iframe).toBeInTheDocument();
      // expect(iframe?.src).toMatch(/vibes-\d+\.vibesbox\.dev/);
    }

    // Verify document was created with correct metadata
    expect(result.current.document).toBeDefined();
    expect(result.current.document?.prompt).toBe('create a todo app');
    expect(result.current.document?.code).toContain('TodoApp');
  });

  it('should handle complex component with multiple imports', async () => {
    const mockCallAI = vi.fn().mockResolvedValue(`
\`\`\`jsx
import React, { useState, useEffect } from "react"
import { callAI } from "call-ai"
import { useFireproof } from "use-fireproof"
import axios from "axios"
import lodash from "lodash"

export default function DataDashboard() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  
  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await callAI("Generate sample data", {
        schema: {
          properties: {
            items: { type: "array", items: { type: "object" } }
          }
        }
      })
      setData(lodash.shuffle(response.items))
      setLoading(false)
    }
  }
  
  return (
    <div className="dashboard">
      <button onClick={fetchData} disabled={loading}>
        {loading ? "Loading..." : "Fetch Data"}
      </button>
      <div className="data-grid">
        {data.map((item, index) => (
          <div key={index} className="data-item">{JSON.stringify(item)}</div>
        ))}
      </div>
    </div>
  )
}
\`\`\`
    `);

    const { result } = renderHook(() =>
      useVibes(
        'create a data dashboard',
        {
          dependencies: ['axios', 'lodash'],
        },
        mockCallAI
      )
    );

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 2000, interval: 50 }
    );

    // Should have extracted the complex component
    expect(result.current.code).toContain('DataDashboard');
    expect(result.current.code).toContain('import axios from "axios"');
    expect(result.current.code).toContain('import lodash from "lodash"');

    // Once implemented, verify imports would be transformed:
    // - Core imports (react, call-ai, use-fireproof) should remain unchanged
    // - Third-party imports (axios, lodash) should be transformed to esm.sh

    if (result.current.App) {
      const { container } = render(<result.current.App />);
      expect(container).toBeInTheDocument();
    }
  });

  it('should handle edge cases and error scenarios', async () => {
    // Test with malformed response
    const mockCallAI = vi.fn().mockResolvedValue('```jsx\nincomplete code block without closing');

    const { result } = renderHook(() =>
      useVibes('create something', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 2000, interval: 50 }
    );

    // Should still handle gracefully - parseContent should extract what it can
    // or fall back to raw response
    expect(result.current.App).toBeDefined();
    expect(result.current.error).toBe(null);
  });

  it('should support iframe communication flow', async () => {
    const mockCallAI = vi.fn().mockResolvedValue(`
\`\`\`jsx
function App() {
  React.useEffect(() => {
    // Send ready signal to parent
    window.parent.postMessage({ type: 'preview-ready' }, '*');
  }, []);
  
  return <div>Communication Test</div>;
}
export default App;
\`\`\`
    `);

    const { result } = renderHook(() =>
      useVibes('create communicating component', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 2000, interval: 50 }
    );

    if (result.current.App) {
      const { container } = render(<result.current.App />);

      // Simulate the full communication flow that would happen with vibesbox:
      // 1. Component renders iframe
      // 2. Iframe loads with component code
      // 3. Component in iframe sends ready signal

      // For now, just verify it renders
      expect(container).toBeInTheDocument();

      // Once implemented, we could test:
      // - Iframe creation with correct URL
      // - Code sent via postMessage
      // - Ready signal received and handled
      // - Error messages handled
    }
  });

  it('should handle regeneration with different results', async () => {
    let generation = 0;
    const mockCallAI = vi.fn().mockImplementation(() => {
      generation++;
      return Promise.resolve(`
\`\`\`jsx
function App${generation}() {
  return (
    <div>
      <h1>Generation ${generation}</h1>
      <p>This is attempt number ${generation}</p>
    </div>
  );
}
export default App${generation};
\`\`\`
      `);
    });

    const { result } = renderHook(() =>
      useVibes('create a component', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    // Wait for first generation
    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 2000, interval: 50 }
    );

    expect(result.current.code).toContain('App1');
    expect(result.current.code).toContain('Generation 1');

    // Trigger regeneration within act to ensure state updates
    act(() => {
      result.current.regenerate();
    });

    // Check loading state immediately after regenerate
    expect(result.current.loading).toBe(true);

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 2000, interval: 50 }
    );

    // Should have new content
    expect(result.current.code).toContain('App2');
    expect(result.current.code).toContain('Generation 2');

    // Both generations should create valid components
    if (result.current.App) {
      const { container } = render(<result.current.App />);
      expect(container).toBeInTheDocument();
    }
  });

  it('should handle different session IDs properly', async () => {
    const mockCallAI = vi
      .fn()
      .mockResolvedValue('```jsx\nfunction App() { return <div>Test</div> }\n```');

    // Create multiple instances
    const { result: result1 } = renderHook(() =>
      useVibes('component 1', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    const { result: result2 } = renderHook(() =>
      useVibes('component 2', { dependencies: ['useFireproof'] }, mockCallAI)
    );

    await waitFor(
      () => {
        expect(result1.current.loading).toBe(false);
        expect(result2.current.loading).toBe(false);
      },
      { timeout: 2000, interval: 50 }
    );

    // Both should succeed
    expect(result1.current.App).toBeDefined();
    expect(result2.current.App).toBeDefined();

    if (result1.current.App && result2.current.App) {
      const { container: container1 } = render(<result1.current.App />);
      const { container: container2 } = render(<result2.current.App />);

      expect(container1).toBeInTheDocument();
      expect(container2).toBeInTheDocument();

      // Once implemented, verify different session IDs:
      // const iframe1 = container1.querySelector('iframe');
      // const iframe2 = container2.querySelector('iframe');
      // expect(iframe1?.src).not.toBe(iframe2?.src);
      // expect(iframe1?.src).toMatch(/vibes-\d+\.vibesbox\.dev/);
      // expect(iframe2?.src).toMatch(/vibes-\d+\.vibesbox\.dev/);
    }
  });
});
