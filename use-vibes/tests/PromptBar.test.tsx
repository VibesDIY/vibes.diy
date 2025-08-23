import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PromptBar } from 'use-vibes-core';

describe('PromptBar Component', () => {
  it('should display the prompt text in view mode', () => {
    // Mock functions
    const setEditedPrompt = vi.fn();
    const handlePromptEdit = vi.fn();

    // Test prompt text
    const promptText = 'Test prompt text';

    // Render component in view mode (editedPrompt is null)
    const { container } = render(
      <PromptBar
        promptText={promptText}
        editedPrompt={null}
        setEditedPrompt={setEditedPrompt}
        handlePromptEdit={handlePromptEdit}
      />
    );

    // Verify the prompt text is displayed
    expect(screen.getByText(promptText)).toBeInTheDocument();

    // Verify the prompt text is in the correct container
    const promptElement = container.querySelector('.imggen-prompt-text');
    expect(promptElement).toBeInTheDocument();
    expect(promptElement).toHaveTextContent(promptText);
  });

  it('should enter edit mode on double-click', () => {
    // Mock functions
    const setEditedPrompt = vi.fn();
    const handlePromptEdit = vi.fn();

    // Test prompt text
    const promptText = 'Test prompt text';

    // Render component in view mode
    const { container } = render(
      <PromptBar
        promptText={promptText}
        editedPrompt={null}
        setEditedPrompt={setEditedPrompt}
        handlePromptEdit={handlePromptEdit}
      />
    );

    // Find the prompt element and double-click it
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const promptElement = container.querySelector('.imggen-prompt-text')!;
    fireEvent.click(promptElement, { detail: 2 }); // Simulate double click

    // Verify setEditedPrompt was called with the prompt text
    expect(setEditedPrompt).toHaveBeenCalledWith(promptText);
  });

  it('should display input field in edit mode', () => {
    // Mock functions
    const setEditedPrompt = vi.fn();
    const handlePromptEdit = vi.fn();

    // Test prompt text and edited prompt
    const promptText = 'Test prompt text';
    const editedPrompt = 'Edited prompt text';

    // Render component in edit mode (editedPrompt is not null)
    render(
      <PromptBar
        promptText={promptText}
        editedPrompt={editedPrompt}
        setEditedPrompt={setEditedPrompt}
        handlePromptEdit={handlePromptEdit}
      />
    );

    // Verify input field is displayed with the edited prompt text
    const inputElement = screen.getByRole('textbox', { name: 'Edit prompt' });
    expect(inputElement).toBeInTheDocument();
    expect(inputElement).toHaveValue(editedPrompt);
  });

  it('should handle prompt edit on Enter key press', () => {
    // Mock functions
    const setEditedPrompt = vi.fn();
    const handlePromptEdit = vi.fn();

    // Test prompt text and edited prompt
    const promptText = 'Test prompt text';
    const editedPrompt = 'Edited prompt text';

    // Render component in edit mode
    render(
      <PromptBar
        promptText={promptText}
        editedPrompt={editedPrompt}
        setEditedPrompt={setEditedPrompt}
        handlePromptEdit={handlePromptEdit}
      />
    );

    // Get input field and press Enter
    const inputElement = screen.getByRole('textbox', { name: 'Edit prompt' });
    fireEvent.keyDown(inputElement, { key: 'Enter' });

    // Verify handlePromptEdit was called with the edited prompt
    expect(handlePromptEdit).toHaveBeenCalledWith(editedPrompt);
  });

  it('should exit edit mode on Escape key press', () => {
    // Mock functions
    const setEditedPrompt = vi.fn();
    const handlePromptEdit = vi.fn();

    // Test prompt text and edited prompt
    const promptText = 'Test prompt text';
    const editedPrompt = 'Edited prompt text';

    // Render component in edit mode
    render(
      <PromptBar
        promptText={promptText}
        editedPrompt={editedPrompt}
        setEditedPrompt={setEditedPrompt}
        handlePromptEdit={handlePromptEdit}
      />
    );

    // Get input field and press Escape
    const inputElement = screen.getByRole('textbox', { name: 'Edit prompt' });
    fireEvent.keyDown(inputElement, { key: 'Escape' });

    // Verify setEditedPrompt was called with null to exit edit mode
    expect(setEditedPrompt).toHaveBeenCalledWith(null);
  });

  // Note: We've intentionally removed the onBlur handler to prevent exit from edit mode when clicking buttons
  it('should not exit edit mode on blur', () => {
    // Mock functions
    const setEditedPrompt = vi.fn();
    const handlePromptEdit = vi.fn();

    // Test prompt text and edited prompt
    const promptText = 'Test prompt text';
    const editedPrompt = 'Edited prompt text';

    // Render component in edit mode
    render(
      <PromptBar
        promptText={promptText}
        editedPrompt={editedPrompt}
        setEditedPrompt={setEditedPrompt}
        handlePromptEdit={handlePromptEdit}
      />
    );

    // Get input field and simulate blur event
    const inputElement = screen.getByRole('textbox', { name: 'Edit prompt' });
    fireEvent.blur(inputElement);

    // Verify setEditedPrompt was NOT called (we removed onBlur handler)
    expect(setEditedPrompt).not.toHaveBeenCalled();
  });
});
