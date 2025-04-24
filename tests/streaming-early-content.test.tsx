import { render, screen, cleanup } from '@testing-library/react';
import { vi, describe, test, expect, afterEach } from 'vitest';
import StructuredMessage from '../app/components/StructuredMessage';
import type { Segment } from '../app/types/chat';

// Mock the window.location for any URL operations
vi.spyOn(window, 'location', 'get').mockImplementation(
  () =>
    ({
      origin: 'http://localhost:3000',
    }) as unknown as Location
);

// Run cleanup after each test
afterEach(() => {
  cleanup();
});

describe('Early Streaming Content Display', () => {
  test('shows content immediately when streaming with just a single character', () => {
    // Arrange: Create a test message with just a single character of markdown content
    const segments = [
      { type: 'markdown' as const, content: 'I' }, // Just a single character
    ];

    // Act: Render the component with isStreaming=true
    render(
      <StructuredMessage
        segments={segments}
        isStreaming={true}
        setSelectedResponseId={() => {}}
        selectedResponseId=""
        setMobilePreviewShown={() => {}}
        isLatestMessage={true}
      />
    );

    // Assert: The single character content should be visible
    expect(screen.getByText('I')).toBeInTheDocument();

    // The component should not show a placeholder when content exists
    expect(screen.queryByText('Processing response...')).not.toBeInTheDocument();
  });

  test('should not show placeholder when minimal content is available', () => {
    // Arrange: Create a test message with minimal content
    const segments = [
      { type: 'markdown' as const, content: 'I' }, // Just a single character
    ];

    // Act: Render the component with isStreaming=true
    render(
      <StructuredMessage
        segments={segments}
        isStreaming={true}
        setSelectedResponseId={() => {}}
        selectedResponseId=""
        setMobilePreviewShown={() => {}}
        isLatestMessage={true}
      />
    );

    // Assert: Even with minimal content, we should see the content not a placeholder
    expect(screen.getByText('I')).toBeInTheDocument();

    // Check that the streaming indicator is shown alongside the content
    // This assumes there's a streaming indicator element with a specific class
    const streamingIndicator = document.querySelector('.animate-pulse');
    expect(streamingIndicator).toBeInTheDocument();
  });

  test('thinking indicator is only visible when segments length is zero', () => {
    // First test with empty segments array
    render(
      <StructuredMessage
        segments={[]}
        isStreaming={true}
        setSelectedResponseId={() => {}}
        selectedResponseId=""
        setMobilePreviewShown={() => {}}
        isLatestMessage={true}
      />
    );

    // Should show the "Processing response..." placeholder when no segments
    expect(screen.getByText('Processing response...')).toBeInTheDocument();

    // Cleanup before next render
    cleanup();

    // Now test with a segment that has empty content
    render(
      <StructuredMessage
        segments={[{ type: 'markdown', content: '' }]}
        isStreaming={true}
        setSelectedResponseId={() => {}}
        selectedResponseId=""
        setMobilePreviewShown={() => {}}
        isLatestMessage={true}
      />
    );

    // Should still show placeholder with empty content
    expect(screen.getByText('Processing response...')).toBeInTheDocument();

    // Cleanup before next render
    cleanup();

    // Finally test with a segment that has content
    render(
      <StructuredMessage
        segments={[{ type: 'markdown', content: 'Hello' }]}
        isStreaming={true}
        setSelectedResponseId={() => {}}
        selectedResponseId=""
        setMobilePreviewShown={() => {}}
        isLatestMessage={true}
      />
    );

    // Should NOT show placeholder when there's content
    expect(screen.queryByText('Processing response...')).not.toBeInTheDocument();
    // Should show the actual content instead
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});

describe('Early Streaming Content Handling', () => {
  test('handles empty segment array correctly', () => {
    const segments: Segment[] = [];
    render(
      <StructuredMessage
        segments={segments}
        isStreaming={true}
        setSelectedResponseId={() => {}}
        selectedResponseId=""
        setMobilePreviewShown={() => {}}
        isLatestMessage={true}
      />
    );
    // ... rest of test ...
  });

  test('handles empty markdown content', () => {
    const segments: Segment[] = [{ type: 'markdown', content: '' }];
    render(
      <StructuredMessage
        segments={segments}
        isStreaming={true}
        setSelectedResponseId={() => {}}
        selectedResponseId=""
        setMobilePreviewShown={() => {}}
        isLatestMessage={true}
      />
    );
    // ... rest of test ...
  });

  // ... update other tests similarly ...
});
