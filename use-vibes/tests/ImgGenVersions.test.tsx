import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Use vi.hoisted to define mocks that need to be referenced in vi.mock
const mockImgFile = vi.hoisted(() =>
  vi.fn().mockImplementation(({ className, alt, style, ...rest }) => {
    return React.createElement(
      'div',
      {
        'data-testid': 'mock-img-file',
        className: `img-file ${className || ''}`,
        style,
        'aria-label': alt,
        ...rest,
        onClick:
          rest.onClick ||
          (() => {
            /* no-op */
          }),
      },
      'Image Content'
    );
  })
);

// Mock use-fireproof module (placed before imports that use it)
vi.mock('use-fireproof', () => ({
  ImgFile: mockImgFile,
  // Mock File constructor for tests
  File: vi.fn().mockImplementation((data, name, options) => ({ name, type: options?.type })),
}));

// Import the components directly to test them individually
import { ImageOverlay } from 'use-vibes-base';

describe('ImageOverlay Component Versions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test that the component correctly displays the prompt text
  it('should display the provided prompt text', () => {
    const mockProps = {
      promptText: 'This is a test prompt',
      editedPrompt: null,
      setEditedPrompt: vi.fn(),
      handlePromptEdit: vi.fn(),
      toggleDeleteConfirm: vi.fn(),
      isDeleteConfirmOpen: false,
      handleDeleteConfirm: vi.fn(),
      handleCancelDelete: vi.fn(),
      handlePrevVersion: vi.fn(),
      handleNextVersion: vi.fn(),
      handleRegen: vi.fn(),
      versionIndex: 0,
      totalVersions: 1,
      showControls: true,
    };

    // Render the component directly
    const { container } = render(<ImageOverlay {...mockProps} />);

    // Verify the prompt text is displayed
    expect(container.textContent).toContain('This is a test prompt');
  });

  // Test for the refresh button functionality
  it('should call handleRegen when refresh button is clicked', () => {
    // Mock the regenerate callback function
    const mockHandleRegen = vi.fn();

    // Create mock props
    const mockProps = {
      promptText: 'Test prompt',
      editedPrompt: null,
      setEditedPrompt: vi.fn(),
      handlePromptEdit: vi.fn(),
      toggleDeleteConfirm: vi.fn(),
      isDeleteConfirmOpen: false,
      handleDeleteConfirm: vi.fn(),
      handleCancelDelete: vi.fn(),
      handlePrevVersion: vi.fn(),
      handleNextVersion: vi.fn(),
      handleRegen: mockHandleRegen,
      versionIndex: 0,
      totalVersions: 1,
      showControls: true,
    };

    // Render the ImageOverlay directly
    const { container } = render(<ImageOverlay {...mockProps} />);

    // Find the regenerate button
    const refreshButton = container.querySelector('[aria-label="Regenerate image"]');
    expect(refreshButton).toBeInTheDocument();

    // Click the regenerate button
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    fireEvent.click(refreshButton!);

    // Verify that the regenerate callback was called
    expect(mockHandleRegen).toHaveBeenCalled();
  });

  // Test version navigation for multiple versions
  it('should call navigation handlers when version buttons are clicked', () => {
    // Mock the navigation handlers
    const mockHandlePrevVersion = vi.fn();
    const mockHandleNextVersion = vi.fn();

    // Create mock props with multiple versions
    const mockProps = {
      promptText: 'Test prompt',
      editedPrompt: null,
      setEditedPrompt: vi.fn(),
      handlePromptEdit: vi.fn(),
      toggleDeleteConfirm: vi.fn(),
      isDeleteConfirmOpen: false,
      handleDeleteConfirm: vi.fn(),
      handleCancelDelete: vi.fn(),
      handlePrevVersion: mockHandlePrevVersion,
      handleNextVersion: mockHandleNextVersion,
      handleRegen: vi.fn(),
      versionIndex: 1, // Middle version (0-based index)
      totalVersions: 3, // Total of 3 versions
      showControls: true,
    };

    // Render the component directly
    const { container } = render(<ImageOverlay {...mockProps} />);

    // Check that we're on version 2 of 3
    const versionIndicator = container.querySelector('.version-indicator');
    expect(versionIndicator).toBeInTheDocument();
    expect(versionIndicator?.textContent).toContain('2 / 3');

    // Test next button
    const nextButton = container.querySelector('[aria-label="Next version"]');
    expect(nextButton).toBeInTheDocument();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    fireEvent.click(nextButton!);
    expect(mockHandleNextVersion).toHaveBeenCalled();

    // Test previous button
    const prevButton = container.querySelector('[aria-label="Previous version"]');
    expect(prevButton).toBeInTheDocument();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    fireEvent.click(prevButton!);
    expect(mockHandlePrevVersion).toHaveBeenCalled();
  });
});
