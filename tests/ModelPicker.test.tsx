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

  it('opens above the trigger by default (positions via bottom)', async () => {
    const onChange = vi.fn();

    const originalInnerHeight = window.innerHeight;
    // Simulate a tall viewport
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    // Force a specific trigger position near the bottom
    const rect = {
      width: 32,
      height: 32,
      top: 700,
      bottom: 732,
      left: 12,
      right: 44,
      x: 12,
      y: 700,
      toJSON: () => ({}),
    } as DOMRect;
    const spy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      // Only care about the trigger; returning this rect is fine for the test
      .mockReturnValue(rect);

    render(
      <MockThemeProvider>
        <ModelPicker currentModel={MODELS[0].id} models={MODELS} onModelChange={onChange} />
      </MockThemeProvider>
    );

    const trigger = screen.getByRole('button', { name: /ai model/i });
    fireEvent.click(trigger);

    const expectedBottom = 800 - rect.top + 8; // viewportH - rect.top + gap
    const menu = await screen.findByRole('menu');
    expect(menu).toHaveStyle(`bottom: ${expectedBottom}px`);
    // Ensure we are using upward-open (no top style applied)
    expect(menu.getAttribute('style') || '').not.toMatch(/top:\s?\d/);

    // Indicator flips upward while open
    const indicator = trigger.querySelector('span:last-child');
    expect(indicator?.textContent).toBe('▴');

    // cleanup spies and globals
    spy.mockRestore();
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it('fits within a small/mobile viewport and is not below the fold near the bottom', async () => {
    const onChange = vi.fn();

    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
    const rect = {
      width: 32,
      height: 32,
      top: 560,
      bottom: 592,
      left: 10,
      right: 42,
      x: 10,
      y: 560,
      toJSON: () => ({}),
    } as DOMRect;
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);

    render(
      <MockThemeProvider>
        <ModelPicker currentModel={MODELS[0].id} models={MODELS} onModelChange={onChange} />
      </MockThemeProvider>
    );

    const trigger = screen.getByRole('button', { name: /ai model/i });
    fireEvent.click(trigger);

    const menu = await screen.findByRole('menu');
    // bottom is positive => menu renders above the fold (toward center)
    const expectedBottom = 600 - rect.top + 8; // > 0
    expect(menu).toHaveStyle(`bottom: ${expectedBottom}px`);

    // Inner list is capped to available space above the trigger
    const list = menu.querySelector('div[style*="max-height"]') as HTMLDivElement | null;
    expect(list).toBeTruthy();
    if (list) {
      const mh = parseInt(list.style.maxHeight, 10);
      expect(mh).toBeLessThanOrEqual(rect.top - 16); // gap padding applied in component
    }

    spy.mockRestore();
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
  });
});
