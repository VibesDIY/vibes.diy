import { useEffect, useId, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

export type ModelOption = { id: string; name: string; description: string; featured?: boolean };

interface ModelPickerProps {
  currentModel?: string;
  onModelChange: (modelId: string) => void | Promise<void>;
  models: ModelOption[];
  globalModel?: string;
  compact?: boolean;
}

/**
 * Compact, accessible model picker for per‑chat runtime selection.
 * Renders an icon‑only trigger (✨) that opens a dropdown list of models.
 */
export default function ModelPicker({
  currentModel,
  onModelChange,
  models,
  globalModel,
  compact,
}: ModelPickerProps) {
  const buttonId = useId();
  const menuId = `model-menu-${buttonId}`;
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Create display list: include all models, ensure featured-first ordering, and include
  // a synthetic global model entry if it's not present in the list.
  const displayModels = useMemo(() => {
    const base = Array.isArray(models) ? models.slice() : [];

    // Include synthetic global model if provided and not already present
    if (globalModel && !base.some((m) => m.id === globalModel)) {
      base.push({
        id: globalModel,
        name: `${globalModel} (Custom)`,
        description: 'Custom openrouter model',
        featured: false,
      });
    }

    // Stable featured-first ordering
    const indexed = base.map((m, i) => ({ m, i }));
    indexed.sort((a, b) => {
      const af = a.m.featured ? 1 : 0;
      const bf = b.m.featured ? 1 : 0;
      if (af !== bf) return bf - af; // featured first
      return a.i - b.i; // preserve original order among equals
    });
    return indexed.map(({ m }) => m);
  }, [models, globalModel]);

  // Find current model for tooltip text from display models (includes synthetic entries)
  const current =
    displayModels.find((m) => m.id === currentModel) || models.find((m) => m.id === currentModel);

  // Manage outside clicks
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (menuRef.current?.contains(target!) || buttonRef.current?.contains(target!)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // Focus the selected item when the menu opens
  useEffect(() => {
    if (!open) return;
    const selected = menuRef.current?.querySelector(
      '[aria-checked="true"]'
    ) as HTMLButtonElement | null;
    selected?.focus();
  }, [open, currentModel]);

  // Compute floating menu position relative to trigger
  const [menuStyle, setMenuStyle] = useState<{
    left: number;
    bottom: number;
    maxHeight: number; // px, fit to available space above trigger
  } | null>(null);
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const gap = 8; // space between trigger and menu
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
      // Default to opening upward: anchor the menu's bottom to just above the trigger
      const bottom = Math.max(0, viewportH - rect.top + gap);
      // Available space above the trigger, minus a small padding
      const availableAbove = Math.max(0, rect.top - gap * 2);
      // Cap to the previous visual max (Tailwind max-h-80 = 20rem ≈ 320px) but never exceed available space
      const maxHeight = Math.min(320, Math.floor(availableAbove));
      setMenuStyle({ left: rect.left, bottom, maxHeight });
    }
  }, [open]);

  // Handle selection
  async function handleSelect(id: string) {
    try {
      setUpdating(true);
      setOpen(false);
      await Promise.resolve(onModelChange(id));
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="relative flex min-w-0 items-center">
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        className="border-light-decorative-00 dark:border-dark-decorative-00 text-light-primary dark:text-dark-primary inline-flex items-center gap-1 rounded-md border bg-gray-100 px-2 py-1 text-sm hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-busy={updating || undefined}
        disabled={updating}
        title={current?.description || 'Switch AI model'}
        aria-label={current?.name ? `AI model: ${current.name}` : 'Change AI model'}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span aria-hidden="true" className="invert saturate-0 dark:invert-0">
          ✨
        </span>
        {!compact && <span className="truncate">{current?.name}</span>}
        <span aria-hidden="true" className="text-light-secondary dark:text-dark-secondary">
          {updating ? '⟳' : open ? '▴' : '▾'}
        </span>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)}>
            <div
              ref={menuRef}
              role="menu"
              id={menuId}
              aria-labelledby={buttonId}
              className="ring-opacity-5 absolute z-[9999] w-64 rounded-md bg-gray-100 p-1 shadow-lg ring-1 ring-black/10 dark:bg-gray-800 dark:ring-white/10"
              style={{
                // Open upward by default by specifying `bottom` instead of `top`.
                bottom: menuStyle?.bottom ?? 0,
                left: menuStyle?.left ?? 0,
                position: 'fixed',
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                const items = Array.from(
                  (menuRef.current?.querySelectorAll('[role="menuitemradio"]') ||
                    []) as NodeListOf<HTMLButtonElement>
                );
                const idx = items.findIndex((el) => el === document.activeElement);
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const next = items[idx + 1] || items[0];
                  next?.focus();
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  const prev = items[idx - 1] || items[items.length - 1];
                  prev?.focus();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setOpen(false);
                  buttonRef.current?.focus();
                }
              }}
            >
              <div
                className="max-h-80 overflow-auto py-1"
                style={{ maxHeight: menuStyle?.maxHeight }}
              >
                {displayModels.map((m) => {
                  const selected = m.id === currentModel;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      className={`flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-white dark:hover:bg-gray-700 ${
                        selected ? 'bg-white dark:bg-gray-700' : ''
                      }`}
                      onClick={() => handleSelect(m.id)}
                    >
                      <span aria-hidden="true" className="w-4 text-center">
                        {selected ? '✓' : ''}
                      </span>
                      <span className="flex-1">
                        <span className="block font-medium">{m.name}</span>
                        <span className="text-light-secondary dark:text-dark-secondary block text-xs">
                          {m.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
