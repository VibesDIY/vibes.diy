import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

// Use vi.hoisted to define mocks that need to be referenced in vi.mock

// Mock use-fireproof module (placed before imports that use it)
vi.mock('use-fireproof', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actual,
    File: vi.fn().mockImplementation((data, name, options) => {
      return { name, type: options?.type };
    }),
    ImgFile: vi.fn().mockImplementation(({ className, alt, style }) => {
      return React.createElement(
        'div',
        {
          'data-testid': 'mock-img-file',
          className: `img-file ${className || ''}`,
          style,
          'aria-label': alt,
        },
        'Image Content'
      );
    }),

    // ImageOverlay: vi.fn(() => <div data-testid="mock-image-overlay">Mocked Image Overlay</div>),
    // DeleteConfirmationOverlay: vi.fn(() => (
    //   <div data-testid="mock-delete-confirmation">Mocked Delete Confirmation</div>
    // )),
    // ImgGenDisplay: vi.fn().mockImplementation((opts) => {

    // }),

    // return React.createElement(
    //   'div',
    //   {
    //     className: `imggen-root ${className || ''}`,
    //     title: document.prompt || alt || 'Generated image',
    //     'data-testid': 'mock-imggen-root',
    //   },
    //   'ImgGenDisplay Content'
    // );
    // }),
    // Mock File constructor for tests
  };
});

import { ImgGenDisplay } from '@vibes.diy/use-vibes-base';

/*
// Mock components from use-vibes-base
vi.mock(import('@vibes.diy/use-vibes-base'), async (actual) => {
  return {
    ...actual,
    ImageOverlay: vi.fn(() => <div data-testid="mock-image-overlay">Mocked Image Overlay</div>),
    DeleteConfirmationOverlay: vi.fn(() => (
      <div data-testid="mock-delete-confirmation">Mocked Delete Confirmation</div>
    )),
  };
});
*/

// Import after mocks

// Type simplification for testing purposes
interface TestDoc {
  readonly _id: string;
  readonly _files: Record<string, File>;
  readonly type: 'image';
  readonly prompt?: string;
  readonly alt?: string;
}

describe('ImgGenDisplay Component', () => {
  // Create a simple document for testing
  function createMockDocument(prompt = 'Test prompt'): TestDoc {
    return {
      _id: 'test-image-id',
      _files: {
        image: new File(['test'], 'test-image.png', { type: 'image/png' }),
      },
      prompt,
      type: 'image',
    };
  }

  beforeEach(() => {
    // Clear all instances and calls to the mock functions before each test
    vi.clearAllMocks();
  });

  it('should add title attribute with prompt text to the root element', () => {
    const mockDoc = createMockDocument('A beautiful landscape with mountains');

    const { container } = render(
      <ImgGenDisplay document={mockDoc} className="test-class" alt="Test alt text" />
    );

    // Find the root element
    const rootElement = container.querySelector('.imggen-root');
    expect(rootElement).toBeInTheDocument();

    // Check if the title attribute has the prompt text
    expect(rootElement).toHaveAttribute('title', 'A beautiful landscape with mountains');
  });

  it('should use alt text as title when prompt is not available', () => {
    // Create a document without a prompt
    const mockDoc: TestDoc = {
      _id: 'test-image-id',
      _files: {
        image: new File(['test'], 'test-image.png', { type: 'image/png' }),
      },
      type: 'image',
    };

    const { container } = render(
      <ImgGenDisplay document={mockDoc} className="test-class" alt="Alternative description text" />
    );

    // Find the root element
    const rootElement = container.querySelector('.imggen-root');
    expect(rootElement).toBeInTheDocument();

    // Check if the title attribute has the alt text when prompt isn't available
    expect(rootElement).toHaveAttribute('title', 'Alternative description text');
  });

  it('should use default text as title when neither prompt nor alt is provided', () => {
    // Create a document without a prompt
    const mockDoc: TestDoc = {
      _id: 'test-image-id',
      _files: {
        image: new File(['test'], 'test-image.png', { type: 'image/png' }),
      },
      type: 'image',
    };

    const { container } = render(<ImgGenDisplay document={mockDoc} className="test-class" />);

    // Find the root element
    const rootElement = container.querySelector('.imggen-root');
    expect(rootElement).toBeInTheDocument();

    // Check if the title attribute has the default text
    expect(rootElement).toHaveAttribute('title', 'Generated image');
  });

  it('should handle complex document structure with versioned prompts', () => {
    // Create a document with versioned prompts that matches the expected structure
    const mockDoc = {
      _id: 'test-image-id',
      _files: {
        // Need to include the standard 'image' key for the mock to work
        image: new File(['test'], 'test-image.png', { type: 'image/png' }),
        'image-v0': new File(['test'], 'test-image.png', { type: 'image/png' }),
        'image-v1': new File(['test'], 'test-image-v1.png', { type: 'image/png' }),
      },
      prompt: 'Fallback prompt text',
      prompts: {
        'prompt-0': { text: 'First version prompt', timestamp: 1620000000000 },
        'prompt-1': { text: 'Second version prompt', timestamp: 1620000001000 },
      },
      currentPromptKey: 'prompt-1',
      versions: [
        { fileKey: 'image-v0', promptKey: 'prompt-0', timestamp: 1620000000000 },
        { fileKey: 'image-v1', promptKey: 'prompt-1', timestamp: 1620000001000 },
      ],
      currentVersion: 1,
      type: 'image' as const,
    } as TestDoc;

    const res = render(<ImgGenDisplay document={mockDoc} className="test-class" />);

    // AsyncImg renders actual img elements
    const imgElements = res.container.querySelectorAll('img');
    expect(imgElements.length).toBeGreaterThan(0);

    // // Since we can't directly test the root element (which may be wrapped by the mock),
    // // we'll verify our mocks were called correctly with the right data
    // // The implementation ensures title attribute is set from the extracted prompt
    // expect(mockImgFile).toHaveBeenCalled();

    // // Reset mock count between tests
    // mockImgFile.mockClear();
  });
});
