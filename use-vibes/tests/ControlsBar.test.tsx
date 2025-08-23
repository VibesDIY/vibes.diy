import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ControlsBar } from '@vibes.diy/use-vibes-base';

describe('ControlsBar Component', () => {
  const defaultProps = {
    handleDeleteConfirm: vi.fn(),
    handlePrevVersion: vi.fn(),
    handleNextVersion: vi.fn(),
    handleRegen: vi.fn(),
    versionIndex: 1,
    totalVersions: 3,
    editedPrompt: null,
    promptText: 'Test prompt',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display delete button when showDelete is true', async () => {
    const { getByLabelText } = render(<ControlsBar {...defaultProps} showDelete={true} />);

    const deleteButton = getByLabelText('Delete image');
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toHaveClass('imggen-button');
    expect(deleteButton).toHaveClass('imggen-delete-button');

    // First click shows confirmation dialog
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    // Look for the confirm delete button and click it
    const confirmButton = getByLabelText('Confirm delete');
    expect(confirmButton).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(confirmButton);
    });
    expect(defaultProps.handleDeleteConfirm).toHaveBeenCalled();
  });

  it('should not display delete button when showDelete is false', () => {
    const { queryByLabelText } = render(<ControlsBar {...defaultProps} showDelete={false} />);

    const deleteButton = queryByLabelText('Delete image');
    expect(deleteButton).not.toBeInTheDocument();
  });

  it('should display version navigation controls when totalVersions > 1', () => {
    const { getByLabelText, getByText } = render(<ControlsBar {...defaultProps} />);

    // Test previous version button
    const prevButton = getByLabelText('Previous version');
    expect(prevButton).toBeInTheDocument();
    fireEvent.click(prevButton);
    expect(defaultProps.handlePrevVersion).toHaveBeenCalled();

    // Test next version button
    const nextButton = getByLabelText('Next version');
    expect(nextButton).toBeInTheDocument();
    fireEvent.click(nextButton);
    expect(defaultProps.handleNextVersion).toHaveBeenCalled();

    // Test version indicator
    const versionIndicator = getByText('2 / 3');
    expect(versionIndicator).toBeInTheDocument();
    expect(versionIndicator).toHaveClass('version-indicator');
  });

  it('should not display version navigation when totalVersions <= 1', () => {
    const { queryByLabelText, queryByText } = render(
      <ControlsBar {...defaultProps} totalVersions={1} />
    );

    // Version navigation should not be present
    expect(queryByLabelText('Previous version')).not.toBeInTheDocument();
    expect(queryByLabelText('Next version')).not.toBeInTheDocument();
    expect(queryByText('1 / 1')).not.toBeInTheDocument();
  });

  it('should disable previous button when on first version', () => {
    const { getByLabelText } = render(<ControlsBar {...defaultProps} versionIndex={0} />);

    const prevButton = getByLabelText('Previous version');
    expect(prevButton).toBeDisabled();
  });

  it('should disable next button when on last version', () => {
    const { getByLabelText } = render(<ControlsBar {...defaultProps} versionIndex={2} />);

    const nextButton = getByLabelText('Next version');
    expect(nextButton).toBeDisabled();
  });

  it('should always display regenerate button', () => {
    const { getByLabelText } = render(<ControlsBar {...defaultProps} />);

    const regenButton = getByLabelText('Regenerate image');
    expect(regenButton).toBeInTheDocument();

    // Test regenerate button click
    fireEvent.click(regenButton);
    expect(defaultProps.handleRegen).toHaveBeenCalled();
  });

  it('should highlight regenerate button when prompt has been edited', () => {
    const editedProps = {
      ...defaultProps,
      editedPrompt: 'Edited prompt',
      promptText: 'Original prompt',
    };

    const { getByLabelText } = render(<ControlsBar {...editedProps} />);

    const regenButton = getByLabelText('Regenerate image');
    expect(regenButton).toHaveClass('imggen-button-highlight');
  });

  it('should display progress bar when progress < 100', () => {
    const { container } = render(<ControlsBar {...defaultProps} progress={50} />);

    const progressBar = container.querySelector('.imggen-progress');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveStyle('width: 50%');
  });

  it('should not display progress bar when progress is 100', () => {
    const { container } = render(<ControlsBar {...defaultProps} progress={100} />);

    const progressBar = container.querySelector('.imggen-progress');
    expect(progressBar).not.toBeInTheDocument();
  });

  it('should disable regenerate button and add spinning class when isRegenerating=true', () => {
    const { getByLabelText } = render(<ControlsBar {...defaultProps} isRegenerating={true} />);

    const regenButton = getByLabelText('Regenerate image');
    expect(regenButton).toBeDisabled();

    // Check that the span inside the button has spinning animation class
    const spinningIcon = regenButton.querySelector('.imggen-regen-spinning');
    expect(spinningIcon).toBeInTheDocument();
  });

  it('should enable regenerate button when isRegenerating=false', () => {
    const { getByLabelText } = render(<ControlsBar {...defaultProps} isRegenerating={false} />);

    const regenButton = getByLabelText('Regenerate image');
    expect(regenButton).not.toBeDisabled();

    // Spinning animation shouldn't be present
    const spinningIcon = regenButton.querySelector('.imggen-regen-spinning');
    expect(spinningIcon).not.toBeInTheDocument();
  });

  it('should display "Generating..." when showControls is false and progress is less than 100', () => {
    const { getByText } = render(
      <ControlsBar {...defaultProps} showControls={false} progress={50} />
    );

    const statusElement = getByText('Generating...');
    expect(statusElement).toBeInTheDocument();
    expect(statusElement).toHaveClass('imggen-status-text');
  });

  it('should not display controls when showControls is false', () => {
    const { queryByLabelText } = render(<ControlsBar {...defaultProps} showControls={false} />);

    // No buttons should be visible
    expect(queryByLabelText('Delete image')).not.toBeInTheDocument();
    expect(queryByLabelText('Previous version')).not.toBeInTheDocument();
    expect(queryByLabelText('Next version')).not.toBeInTheDocument();
    expect(queryByLabelText('Regenerate image')).not.toBeInTheDocument();
  });
});
