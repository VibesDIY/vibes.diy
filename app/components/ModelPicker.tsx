import { useEffect, useId, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

export type ModelOption = { id: string; name: string; description: string; featured?: boolean };

interface ModelPickerProps {
  currentModel?: string;
  onModelChange: (modelId: string) => void | Promise<void>;
  models: ModelOption[];
  globalModel?: string;
}

/**
 * Compact, accessible model picker for per‑chat runtime selection.
 * Renders an icon‑only trigger (✨) that opens a dropdown list of models.
 */
export default function ModelPicker({ currentModel, onModelChange, models, globalModel }: ModelPickerProps) {
  const buttonId = useId();
  const menuId = `model-menu-${buttonId}`;
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Debug logging
  console.log('ModelPicker render - globalModel:', globalModel);
  console.log('ModelPicker render - currentModel:', currentModel);

  // Create display list: global model + featured models (deduplicated)
  const displayModels = useMemo(() => {
    console.log('useMemo recalculating displayModels - globalModel:', globalModel);
    const featuredModels = models.filter((m) => m.featured);
    console.log('featuredModels:', featuredModels.map(m => m.id));
    
    if (!globalModel) {
      console.log('No globalModel, returning featuredModels only');
      return featuredModels;
    }
    
    // Find global model in full models list
    const globalModelObj = models.find((m) => m.id === globalModel);
    console.log('globalModelObj found:', !!globalModelObj, globalModelObj?.name);
    
    if (globalModelObj) {
      // Remove global model from featured list to avoid duplicates, then add it at the top
      const featuredWithoutGlobal = featuredModels.filter((m) => m.id !== globalModel);
      const result = [globalModelObj, ...featuredWithoutGlobal];
      console.log('Final displayModels with globalModel:', result.map(m => m.id));
      return result;
    } else {
      // Create synthetic entry for models not in the list
      const syntheticGlobalModel: ModelOption = {
        id: globalModel,
        name: `${globalModel} (Global Setting)`,
        description: 'Model from global settings',
        featured: false
      };
      const result = [syntheticGlobalModel, ...featuredModels];
      console.log('Final displayModels with synthetic globalModel:', result.map(m => m.id));
      return result;
    }
  }, [models, globalModel]);

  // Find current model for tooltip text from display models (includes synthetic entries)
  const current = displayModels.find((m) => m.id === currentModel) || models.find((m) => m.id === currentModel);
  
  // Debug: log the actual list of options that will be rendered
  console.log('ModelPicker - displayModels in dropdown:', displayModels.map(m => ({ id: m.id, name: m.name })));

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
        <span aria-hidden="true" className="saturate-0 invert">
          ✨
        </span>
        <span className="hidden truncate sm:block">{current?.name}</span>
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
