import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { ImageOverlay, defaultClasses } from 'use-vibes-base';

describe('ImageOverlay Component', () => {
  // Mock functions for all the callbacks
  const mockPrevVersion = vi.fn();
  const mockNextVersion = vi.fn();
  const mockRegen = vi.fn();
  const mockSetEditedPrompt = vi.fn();
  const mockHandlePromptEdit = vi.fn();
  const mockToggleDeleteConfirm = vi.fn();
  const mockHandleDeleteConfirm = vi.fn();
  const mockHandleCancelDelete = vi.fn();

  // Default props to be used in most tests
  const defaultProps = {
    promptText: 'Test prompt',
    editedPrompt: null,
    setEditedPrompt: mockSetEditedPrompt,
    handlePromptEdit: mockHandlePromptEdit,
    toggleDeleteConfirm: mockToggleDeleteConfirm,
    isDeleteConfirmOpen: false,
    handleDeleteConfirm: mockHandleDeleteConfirm,
    handleCancelDelete: mockHandleCancelDelete,
    handlePrevVersion: mockPrevVersion,
    handleNextVersion: mockNextVersion,
    handleRegen: mockRegen,
    versionIndex: 0,
    totalVersions: 1,
    classes: defaultClasses,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  //---------------------------------------------------------------
  // A. Rendering / Layout Tests
  //---------------------------------------------------------------
  describe('Rendering & Layout', () => {
    it('renders prompt text in read-only mode by default', () => {
      render(<ImageOverlay {...defaultProps} />);
      expect(screen.getByText('Test prompt')).toBeInTheDocument();
      // No input should be present
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('applies title to prompt', () => {
      const { container } = render(<ImageOverlay {...defaultProps} />);
      const promptText = container.querySelector('.imggen-prompt-text');
      expect(promptText).toHaveAttribute('title', 'Click to edit prompt');
    });

    it('wraps root container with imggen-overlay class', () => {
      const { container } = render(<ImageOverlay {...defaultProps} />);
      expect(container.querySelector('.imggen-overlay')).toBeInTheDocument();
    });
  });

  //---------------------------------------------------------------
  // B. Controls Visible Tests (showControls = true, default)
  //---------------------------------------------------------------
  describe('Controls Visible (default)', () => {
    it('shows regenerate button that triggers handleRegen when clicked', () => {
      render(<ImageOverlay {...defaultProps} />);
      const regenButton = screen.getByRole('button', { name: /regenerate image/i });
      expect(regenButton).toBeInTheDocument();

      fireEvent.click(regenButton);
      expect(mockRegen).toHaveBeenCalledTimes(1);
    });

    it('does not render prev/next buttons or version indicator when totalVersions = 1', () => {
      render(<ImageOverlay {...defaultProps} totalVersions={1} />);

      expect(screen.queryByRole('button', { name: /previous version/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /next version/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/1 \/ 1/)).not.toBeInTheDocument();
    });

    it('renders prev/next buttons and version indicator when totalVersions > 1', () => {
      render(<ImageOverlay {...defaultProps} totalVersions={3} versionIndex={1} />);

      expect(screen.getByRole('button', { name: /previous version/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next version/i })).toBeInTheDocument();
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });

    it('disables prev button when at first version', () => {
      render(<ImageOverlay {...defaultProps} totalVersions={3} versionIndex={0} />);

      const prevButton = screen.getByRole('button', { name: /previous version/i });
      expect(prevButton).toBeDisabled();

      const nextButton = screen.getByRole('button', { name: /next version/i });
      expect(nextButton).not.toBeDisabled();
    });

    it('disables next button when at last version', () => {
      render(<ImageOverlay {...defaultProps} totalVersions={3} versionIndex={2} />);

      const prevButton = screen.getByRole('button', { name: /previous version/i });
      expect(prevButton).not.toBeDisabled();

      const nextButton = screen.getByRole('button', { name: /next version/i });
      expect(nextButton).toBeDisabled();
    });

    it('calls handlePrevVersion/handleNextVersion when buttons clicked', () => {
      render(<ImageOverlay {...defaultProps} totalVersions={3} versionIndex={1} />);

      // Click Previous
      const prevButton = screen.getByRole('button', { name: /previous version/i });
      fireEvent.click(prevButton);
      expect(mockPrevVersion).toHaveBeenCalledTimes(1);

      // Click Next
      const nextButton = screen.getByRole('button', { name: /next version/i });
      fireEvent.click(nextButton);
      expect(mockNextVersion).toHaveBeenCalledTimes(1);
    });

    it('adds the correct CSS classes to the buttons', () => {
      const { container } = render(
        <ImageOverlay {...defaultProps} totalVersions={3} versionIndex={1} />
      );

      const buttons = container.querySelectorAll('button');
      buttons.forEach((button) => {
        // All buttons should have the imggen-button class
        expect(button).toHaveClass('imggen-button');
      });
    });
  });

  //---------------------------------------------------------------
  // C. Controls Hidden Tests (showControls = false)
  //---------------------------------------------------------------
  describe('Controls Hidden', () => {
    it('shows "Generating..." text when showControls=false and progress < 100', () => {
      const { container } = render(
        <ImageOverlay {...defaultProps} showControls={false} progress={50} />
      );

      // Find the status text element directly
      const statusText = container.querySelector('.imggen-status-text');
      expect(statusText).toBeInTheDocument();
      expect(statusText).toHaveTextContent('Generating...');

      // Controls should not be visible
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    // Test removed since we always show "Generating..." when controls are hidden
  });

  //---------------------------------------------------------------
  // D. Prompt Editing Behavior Tests
  //---------------------------------------------------------------
  describe('Prompt Editing Behavior', () => {
    it('switches to edit mode when prompt text is double clicked', () => {
      render(<ImageOverlay {...defaultProps} />);

      const promptText = screen.getByText('Test prompt');
      // Manual double click simulation
      fireEvent.click(promptText, { detail: 2 });

      expect(mockSetEditedPrompt).toHaveBeenCalledWith('Test prompt');
    });

    it('shows input field with current text when in edit mode', () => {
      render(<ImageOverlay {...defaultProps} editedPrompt="Edited prompt" />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('Edited prompt');
      expect(input).toHaveFocus();
    });

    it('calls handlePromptEdit when Enter key is pressed in edit mode', () => {
      render(<ImageOverlay {...defaultProps} editedPrompt="Edited prompt" />);

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockHandlePromptEdit).toHaveBeenCalledWith('Edited prompt');
    });

    it('exits edit mode without calling handlePromptEdit when Escape key is pressed', () => {
      render(<ImageOverlay {...defaultProps} editedPrompt="Edited prompt" />);

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockSetEditedPrompt).toHaveBeenCalledWith(null);
      expect(mockHandlePromptEdit).not.toHaveBeenCalled();
    });

    it('should not exit edit mode when input loses focus', () => {
      // Given
      const mockSetEditedPrompt = vi.fn();

      render(
        <ImageOverlay
          {...defaultProps}
          editedPrompt="test edit"
          setEditedPrompt={mockSetEditedPrompt}
        />
      );

      const input = screen.getByRole('textbox');
      fireEvent.blur(input);

      // Verify setEditedPrompt was NOT called (we removed onBlur handler)
      expect(mockSetEditedPrompt).not.toHaveBeenCalled();
    });

    it('updates edited prompt value as user types', () => {
      render(<ImageOverlay {...defaultProps} editedPrompt="Initial text" />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Updated text' } });

      expect(mockSetEditedPrompt).toHaveBeenCalledWith('Updated text');
    });
  });

  //---------------------------------------------------------------
  // E. Accessibility Tests
  //---------------------------------------------------------------
  describe('Accessibility', () => {
    it('provides proper aria labels for interactive elements', () => {
      render(<ImageOverlay {...defaultProps} totalVersions={3} versionIndex={1} />);

      // Version controls
      expect(screen.getByRole('button', { name: 'Previous version' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next version' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Regenerate image' })).toBeInTheDocument();

      // Delete control (should be available when enableDelete is true)
      expect(screen.getByRole('button', { name: 'Delete image' })).toBeInTheDocument();
    });

    it('includes aria-label for input in edit mode', () => {
      render(<ImageOverlay {...defaultProps} editedPrompt="Edited prompt" />);

      expect(screen.getByRole('textbox', { name: 'Edit prompt' })).toBeInTheDocument();
    });

    it('has aria-live attribute on version indicator', () => {
      const { container } = render(
        <ImageOverlay {...defaultProps} totalVersions={3} versionIndex={1} />
      );

      const versionIndicator = container.querySelector('.imggen-version-indicator');
      expect(versionIndicator).toHaveAttribute('aria-live', 'polite');
    });
  });
});
