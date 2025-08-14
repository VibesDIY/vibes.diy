import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_DEPENDENCIES, llmsCatalog, CATALOG_DEPENDENCY_NAMES } from '~/llms/catalog';

type AppSettingsViewProps = {
  title: string;
  onUpdateTitle: (next: string, isManual?: boolean) => Promise<void>;
  onDownloadHtml: () => void;
  selectedDependencies?: string[];
  dependenciesUserOverride?: boolean;
  // When saving a manual selection, we set `userOverride` true
  onUpdateDependencies?: (deps: string[], userOverride: boolean) => Promise<void> | void;
  // Instructional text and demo data override settings
  instructionalTextOverride?: boolean;
  demoDataOverride?: boolean;
  onUpdateInstructionalTextOverride?: (override?: boolean) => Promise<void> | void;
  onUpdateDemoDataOverride?: (override?: boolean) => Promise<void> | void;
};

const AppSettingsView: React.FC<AppSettingsViewProps> = ({
  title,
  onUpdateTitle,
  onDownloadHtml,
  selectedDependencies,
  dependenciesUserOverride,
  onUpdateDependencies,
  instructionalTextOverride,
  demoDataOverride,
  onUpdateInstructionalTextOverride,
  onUpdateDemoDataOverride,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(title);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // Per‑vibe libraries selection state
  const catalogNames = useMemo(() => CATALOG_DEPENDENCY_NAMES, []);
  const initialDeps = useMemo(() => {
    const useManual = !!dependenciesUserOverride;
    const input = useManual
      ? Array.isArray(selectedDependencies)
        ? selectedDependencies
        : []
      : [];
    return input
      .filter((n): n is string => typeof n === 'string')
      .filter((n) => catalogNames.has(n));
  }, [selectedDependencies, dependenciesUserOverride, catalogNames]);
  const [deps, setDeps] = useState<string[]>(initialDeps);
  const [hasUnsavedDeps, setHasUnsavedDeps] = useState(false);
  const [saveDepsOk, setSaveDepsOk] = useState(false);
  const [saveDepsErr, setSaveDepsErr] = useState<string | null>(null);

  useEffect(() => {
    setEditedName(title);
  }, [title]);

  useEffect(() => {
    // Sync local selection when external changes land
    setDeps(initialDeps);
    setHasUnsavedDeps(false);
  }, [initialDeps]);

  const handleEditNameStart = useCallback(() => {
    setIsEditingName(true);
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
  }, []);

  const handleNameSave = useCallback(async () => {
    const trimmedName = editedName.trim();
    if (trimmedName && trimmedName !== title) {
      await onUpdateTitle(trimmedName, true); // Mark as manually set
    }
    setIsEditingName(false);
  }, [editedName, title, onUpdateTitle]);

  const handleNameCancel = useCallback(() => {
    setEditedName(title);
    setIsEditingName(false);
  }, [title]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleNameSave();
      } else if (e.key === 'Escape') {
        handleNameCancel();
      }
    },
    [handleNameSave, handleNameCancel]
  );

  // Libraries handlers
  const toggleDependency = useCallback((name: string, checked: boolean) => {
    setDeps((prev) => {
      const set = new Set(prev);
      if (checked) set.add(name);
      else set.delete(name);
      return Array.from(set);
    });
    setHasUnsavedDeps(true);
  }, []);

  const handleSaveDeps = useCallback(async () => {
    setSaveDepsErr(null);
    try {
      const valid = deps.filter((n) => catalogNames.has(n));
      await onUpdateDependencies?.(valid.length ? valid : DEFAULT_DEPENDENCIES, true);
      setHasUnsavedDeps(false);
      setSaveDepsOk(true);
      setTimeout(() => setSaveDepsOk(false), 2000);
    } catch (e: any) {
      setSaveDepsErr(e?.message || 'Failed to save libraries');
    }
  }, [deps, onUpdateDependencies, catalogNames]);

  // Instructional text and demo data handlers
  const handleInstructionalTextChange = useCallback(
    (value: 'llm' | 'on' | 'off') => {
      const override = value === 'llm' ? undefined : value === 'on';
      onUpdateInstructionalTextOverride?.(override);
    },
    [onUpdateInstructionalTextOverride]
  );

  const handleDemoDataChange = useCallback(
    (value: 'llm' | 'on' | 'off') => {
      const override = value === 'llm' ? undefined : value === 'on';
      onUpdateDemoDataOverride?.(override);
    },
    [onUpdateDemoDataOverride]
  );

  return (
    <div className="flex h-full justify-center p-8 pt-16 overflow-y-scroll">
      <div className="w-full max-w-2xl">
        <h2 className="text-light-primary dark:text-dark-primary mb-6 text-center text-2xl font-semibold">
          App Settings
        </h2>

        <div className="space-y-6">
          <div className="bg-light-background-01 dark:bg-dark-background-01 border-light-decorative-01 dark:border-dark-decorative-01 rounded-lg border p-6">
            <h3 className="text-light-primary dark:text-dark-primary mb-4 text-lg font-medium">
              General Settings
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-light-primary dark:text-dark-primary opacity-60">
                  You are in <strong>dev mode</strong>. Data is temporary until you publish your app
                  with the share button at top right. You can set the name of your app here or
                  continue to autogenerate names.
                </p>
                <label className="text-light-primary dark:text-dark-primary block pt-2 text-sm font-semibold">
                  App Name
                </label>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={handleNameKeyDown}
                      onBlur={handleNameSave}
                      className="dark:bg-dark-background-00 text-light-primary dark:text-dark-primary flex-1 rounded border-2 border-blue-500 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-500/30 focus:outline-none dark:border-blue-400 dark:focus:border-blue-300 dark:focus:ring-blue-400/30"
                      placeholder="Enter app name"
                    />
                    <button
                      onClick={handleNameSave}
                      className="hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 rounded p-1 text-green-600 dark:text-green-400"
                      title="Save"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={handleNameCancel}
                      className="hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 rounded p-1 text-red-600 dark:text-red-400"
                      title="Cancel"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="dark:bg-dark-background-01 dark:border-dark-decorative-01 text-light-primary dark:text-dark-primary flex-1 cursor-default rounded border border-gray-200 bg-gray-50 px-3 py-2 font-medium">
                      {title}
                    </div>
                    <button
                      onClick={handleEditNameStart}
                      className="bg-light-background-01 dark:bg-dark-decorative-01 text-light-secondary dark:text-dark-secondary hover:bg-light-background-02 dark:hover:bg-dark-decorative-00 focus:ring-light-border-01 dark:focus:ring-dark-border-01 rounded-md px-4 py-2 text-sm font-semibold shadow transition-colors focus:ring-1 focus:outline-none"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>

              <div className="opacity-60">
                <div className="text-light-primary dark:text-dark-primary mb-1 flex items-center gap-2 font-medium">
                  Custom Domain
                  <span className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-2 py-0.5 text-xs font-medium text-white">
                    ✨ Pro
                  </span>
                  <span className="inline-flex items-center rounded-full bg-orange-500 px-2 py-0.5 text-xs font-medium text-white">
                    🚀 Soon
                  </span>
                </div>
                <div className="text-light-primary/70 dark:text-dark-primary/70 text-sm">
                  {title !== 'Untitled App'
                    ? `${title.toLowerCase().replace(/\s+/g, '-')}.vibesdiy.app`
                    : 'app-name.vibesdiy.app'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-light-background-01 dark:bg-dark-background-01 border-light-decorative-01 dark:border-dark-decorative-01 rounded-lg border p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-light-primary dark:text-dark-primary text-lg font-medium">
                Libraries
              </h3>
              <button
                onClick={handleSaveDeps}
                disabled={!hasUnsavedDeps}
                className={`rounded px-4 py-2 text-sm text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                  hasUnsavedDeps
                    ? 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500'
                    : 'accent-01 dark:bg-dark-decorative-01 cursor-not-allowed'
                }`}
              >
                Save
              </button>
            </div>
            {saveDepsOk && (
              <div className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
                Libraries saved.
              </div>
            )}
            {saveDepsErr && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                {saveDepsErr}
              </div>
            )}
            <p className="text-accent-01 dark:text-accent-01 mb-3 text-sm">
              Choose which libraries to include in generated apps for this Vibe. This controls
              imports and docs used in prompts.
            </p>
            {!dependenciesUserOverride && (
              <div className="mb-4 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300">
                Libraries, instructional text, and demo data are currently chosen by the LLM at
                runtime. Select libraries and click Save to set a manual override for this vibe.
              </div>
            )}
            {llmsCatalog.length === 0 ? (
              <div className="text-accent-01 dark:text-dark-secondary text-sm">
                No libraries available.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {llmsCatalog.map((mod) => {
                  const checked = deps.includes(mod.name);
                  return (
                    <label
                      key={mod.name}
                      className="border-light-decorative-01 dark:border-dark-decorative-01 flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        onChange={(e) => toggleDependency(mod.name, e.target.checked)}
                      />
                      <span>
                        <span className="font-medium">{mod.label}</span>
                        {mod.description ? (
                          <span className="text-accent-01 dark:text-dark-secondary block text-xs">
                            {mod.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-light-background-01 dark:bg-dark-background-01 border-light-decorative-01 dark:border-dark-decorative-01 rounded-lg border p-6">
            <h3 className="text-light-primary dark:text-dark-primary mb-4 text-lg font-medium">
              Prompt Options
            </h3>
            <p className="text-accent-01 dark:text-accent-01 mb-4 text-sm">
              Control how the AI generates code for this Vibe. You can let the LLM decide or
              override specific settings.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-light-primary dark:text-dark-primary mb-2 block text-sm font-semibold">
                  Instructional Text
                </label>
                <div className="space-y-2">
                  {(['llm', 'on', 'off'] as const).map((value) => {
                    const currentValue =
                      instructionalTextOverride === undefined
                        ? 'llm'
                        : instructionalTextOverride
                          ? 'on'
                          : 'off';
                    const isChecked = currentValue === value;
                    const labels = {
                      llm: 'Let LLM decide',
                      on: 'Always include instructional text',
                      off: 'Never include instructional text',
                    };

                    return (
                      <label
                        key={value}
                        className="border-light-decorative-01 dark:border-dark-decorative-01 flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
                      >
                        <input
                          type="radio"
                          name="instructionalText"
                          value={value}
                          checked={isChecked}
                          onChange={() => handleInstructionalTextChange(value)}
                          className="mt-0.5"
                        />
                        <span className="text-light-primary dark:text-dark-primary">
                          {labels[value]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-light-primary dark:text-dark-primary mb-2 block text-sm font-semibold">
                  Demo Data
                </label>
                <div className="space-y-2">
                  {(['llm', 'on', 'off'] as const).map((value) => {
                    const currentValue =
                      demoDataOverride === undefined ? 'llm' : demoDataOverride ? 'on' : 'off';
                    const isChecked = currentValue === value;
                    const labels = {
                      llm: 'Let LLM decide',
                      on: 'Always include demo data',
                      off: 'Never include demo data',
                    };

                    return (
                      <label
                        key={value}
                        className="border-light-decorative-01 dark:border-dark-decorative-01 flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
                      >
                        <input
                          type="radio"
                          name="demoData"
                          value={value}
                          checked={isChecked}
                          onChange={() => handleDemoDataChange(value)}
                          className="mt-0.5"
                        />
                        <span className="text-light-primary dark:text-dark-primary">
                          {labels[value]}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-light-background-01 dark:bg-dark-background-01 border-light-decorative-01 dark:border-dark-decorative-01 rounded-lg border p-6">
            <h3 className="text-light-primary dark:text-dark-primary mb-4 text-lg font-medium">
              Export Options
            </h3>
            <div className="space-y-3">
              <div
                className="bg-light-background-00 dark:bg-dark-background-00 border-light-decorative-01 dark:border-dark-decorative-01 hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 flex cursor-pointer items-center rounded-lg border p-4 transition-colors"
                onClick={onDownloadHtml}
              >
                <div className="flex-1">
                  <div className="text-light-primary dark:text-dark-primary font-medium">
                    Download html
                  </div>
                  <div className="text-light-primary/70 dark:text-dark-primary/70 text-sm">
                    Just open it in your browser.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppSettingsView;
