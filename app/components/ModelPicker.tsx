import { useId, useState } from 'react';

export type ModelOption = { id: string; name: string; description: string };

interface ModelPickerProps {
  currentModel?: string;
  onModelChange: (modelId: string) => void | Promise<void>;
  models: ModelOption[];
}

/**
 * Compact, accessible model picker for per‑chat runtime selection.
 * Uses a native <select> for keyboard and mobile support.
 */
export default function ModelPicker({ currentModel, onModelChange, models }: ModelPickerProps) {
  const selectId = useId();
  const [updating, setUpdating] = useState(false);

  // Find label for current model id, fall back gracefully
  const current = models.find((m) => m.id === currentModel);
  const value = current?.id ?? currentModel ?? models[0]?.id ?? '';

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={selectId} className="sr-only">
        AI model
      </label>
      <div className="relative">
        <select
          id={selectId}
          aria-label="AI model"
          title={current?.description || 'Select AI model'}
          className="border-light-decorative-00 dark:border-dark-decorative-00 text-light-primary dark:text-dark-primary bg-light-background-01 dark:bg-dark-background-01 focus:ring-accent-01-light dark:focus:ring-accent-01-dark max-w-[60vw] rounded-md border px-2 py-1 pr-7 text-xs sm:text-sm"
          value={value}
          onChange={async (e) => {
            const id = e.target.value;
            try {
              setUpdating(true);
              await Promise.resolve(onModelChange(id));
            } finally {
              setUpdating(false);
            }
          }}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id} title={m.description}>
              {m.name}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="text-light-secondary dark:text-dark-secondary pointer-events-none absolute inset-y-0 right-1 flex items-center"
        >
          {updating ? '⟳' : '▾'}
        </span>
      </div>
    </div>
  );
}
