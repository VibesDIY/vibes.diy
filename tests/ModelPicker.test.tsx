import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ModelPicker from '../app/components/ModelPicker';
import { MockThemeProvider } from './utils/MockThemeProvider';

const MODELS = [
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', description: 'Best for coding' },
  { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', description: 'Fast + frugal' },
];

describe('ModelPicker', () => {
  it('renders icon trigger and opens the dropdown', () => {
    const onChange = vi.fn();
    render(
      <MockThemeProvider>
        <ModelPicker currentModel={MODELS[0].id} models={MODELS} onModelChange={onChange} />
      </MockThemeProvider>
    );

    const trigger = screen.getByRole('button', { name: /ai model/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Current option is marked selected
    const currentItem = screen.getByRole('menuitemradio', { name: /Claude Sonnet 4/i });
    expect(currentItem).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onModelChange and exposes busy state while persisting', async () => {
    let resolveSelection: () => void = () => {};
    const onChange = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSelection = resolve;
        })
    );

    render(
      <MockThemeProvider>
        <ModelPicker currentModel={MODELS[0].id} models={MODELS} onModelChange={onChange} />
      </MockThemeProvider>
    );

    const trigger = screen.getByRole('button', { name: /ai model/i });
    fireEvent.click(trigger);

    const targetItem = screen.getByRole('menuitemradio', { name: /Llama 3.1 8B/i });
    fireEvent.click(targetItem);

    expect(onChange).toHaveBeenCalledWith(MODELS[1].id);
    // Busy state should be exposed on the trigger
    await waitFor(() => expect(trigger).toHaveAttribute('aria-busy', 'true'));

    // Resolve the pending persist
    resolveSelection();

    await waitFor(() => expect(trigger).not.toHaveAttribute('aria-busy'));
  });
});
