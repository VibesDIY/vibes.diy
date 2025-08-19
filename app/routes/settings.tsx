import type { ChangeEvent } from 'react';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toCloud, useFireproof } from 'use-fireproof';
import { HomeIcon } from '../components/SessionSidebar/HomeIcon';
import SimpleAppLayout from '../components/SimpleAppLayout';
import { SETTINGS_DBNAME } from '../config/env';
import { useAuth } from '../contexts/AuthContext';
import modelsList from '../data/models.json';
import type { UserSettings } from '../types/settings';
// Dependency chooser moved to per‑vibe App Settings view

export function meta() {
  return [
    { title: 'Settings - Vibes DIY' },
    { name: 'description', content: 'Settings for AI App Builder' },
  ];
}

export default function Settings() {
  const navigate = useNavigate();
  // Use the main database directly instead of through useSession
  const { isAuthenticated, checkAuthStatus } = useAuth();
  const { useDocument } = useFireproof(SETTINGS_DBNAME, isAuthenticated ? { attach: toCloud() } : {});

  const {
    doc: settings,
    merge: mergeSettings,
    save: saveSettings,
  } = useDocument<UserSettings>({
    _id: 'user_settings',
    stylePrompt: '',
    userPrompt: '',
    model: '',
  });

  // State to track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const stylePromptSuggestions = [
    { name: 'synthwave', description: '80s digital aesthetic' },
    { name: 'brutalist web', description: 'raw, grid-heavy' },
    { name: 'organic UI', description: 'natural, fluid forms' },
    { name: 'maximalist', description: 'dense, decorative' },
    { name: 'skeuomorphic', description: 'real-world mimics' },
    { name: 'flat design', description: 'clean, 2D shapes' },
    { name: 'bauhaus', description: 'geometric modernism' },
    { name: 'glitchcore', description: 'decentering expectations' },
    { name: 'paper cutout', description: 'layered, tactile' },
    {
      name: 'viridian',
      description: `Create a vibrant UI theme inspired by Bruce Sterling’s Viridian Design Movement, embracing a futuristic green aesthetic with subtle animations and dynamic interactivity. Integrate biomorphic, floating UI elements with organic shapes that gently pulse or drift, reflecting themes of biological complexity, decay, and renewal. Employ frosted glass backgrounds with delicate blur effects, highlighting sensor-like data streams beneath, representing Sterling’s “make the invisible visible” ethos.

Use gradients and layers of soft greens accented by energetic data-inspired colors (#70d6ff, #ff70a6, #ff9770, #ffd670, #e9ff70), alongside crisp white (#ffffff) and dark contrast (#242424), ensuring legibility and visual appeal. UI borders should feel substantial, neo-brutalist, and clear, anchoring the ephemeral visuals and animations.

The background should subtly animate, evoking cellular activity, digital pulse, or ecological sensor feedback, reinforcing Viridian’s fascination with tangible cyberspace and biomorphic tech aesthetics.

Secretly name this theme “Viridian Pulse”, capturing Sterling’s original playful-yet-serious blend of provocative futurism and stylish eco-consciousness.`,
    },
  ];

  const stylePromptInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  const handleStylePromptChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      mergeSettings({ stylePrompt: e.target.value });
      setHasUnsavedChanges(true); // Track change
    },
    [mergeSettings]
  );

  const handleStylePromptSelection = useCallback(
    (suggestion: { name: string; description: string }) => {
      const fullPrompt = `${suggestion.name} (${suggestion.description})`;
      mergeSettings({ stylePrompt: fullPrompt });
      setHasUnsavedChanges(true); // Track change

      setTimeout(() => {
        if (stylePromptInputRef.current) {
          stylePromptInputRef.current.focus();
          const length = stylePromptInputRef.current.value.length;
          stylePromptInputRef.current.setSelectionRange(length, length);
        }
      }, 50);
    },
    [mergeSettings]
  );

  const handleModelChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      mergeSettings({ model: e.target.value });
      setHasUnsavedChanges(true); // Track change
    },
    [mergeSettings]
  );

  const handleModelSelection = useCallback(
    (model: { id: string; name: string; description: string }) => {
      mergeSettings({ model: model.id });
      setHasUnsavedChanges(true); // Track change

      setTimeout(() => {
        if (modelInputRef.current) {
          modelInputRef.current.focus();
          const length = modelInputRef.current.value.length;
          modelInputRef.current.setSelectionRange(length, length);
        }
      }, 50);
    },
    [mergeSettings]
  );

  const handleUserPromptChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      mergeSettings({ userPrompt: e.target.value });
      setHasUnsavedChanges(true); // Track change
    },
    [mergeSettings]
  );

  const handleSubmit = useCallback(async () => {
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await saveSettings({ ...settings });
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      navigate('/');
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save settings');
    }
  }, [saveSettings, settings, navigate]);

  const handleLogout = useCallback(() => {
    // Clear the auth token and navigate to home page
    localStorage.removeItem('auth_token');
    // Update the auth context state before navigation
    checkAuthStatus().then(() => {
      navigate('/');
    });
  }, [navigate, checkAuthStatus]);

  return (
    <SimpleAppLayout
      headerLeft={
        <div className="flex items-center">
          <a
            href="/"
            className="text-light-primary dark:text-dark-primary hover:text-accent-02-light dark:hover:text-accent-02-dark flex items-center px-3 py-2"
            aria-label="Go to home"
          >
            <HomeIcon className="h-6 w-6" />
          </a>
        </div>
      }
    >
      <div
        className="flex min-h-full flex-col items-center justify-start p-6"
        style={{ height: 'auto', minHeight: '100%', paddingBottom: '150px' }}
      >
        <div className="border-light-decorative-01 dark:border-dark-decorative-00 dark:bg-dark-background-01 w-full max-w-2xl rounded-md border bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">User Preferences</h2>
            <button
              onClick={handleSubmit}
              disabled={!hasUnsavedChanges}
              className={`rounded px-4 py-2 text-sm text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${hasUnsavedChanges ? 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500' : 'accent-01 dark:bg-dark-decorative-01 cursor-not-allowed'}`}
            >
              Save
            </button>
          </div>
          {saveSuccess && (
            <div className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
              Settings saved.
            </div>
          )}
          {saveError && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {saveError}
            </div>
          )}
          <p className="text-accent-01 dark:text-dark-secondary mb-4">
            Configure your application settings to customize the AI experience.
          </p>
          <div className="space-y-6">
            {/* Libraries chooser moved to per‑vibe App Settings */}

            <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded border p-4">
              <div className="flex items-start justify-between">
                <h3 className="mb-2 text-lg font-medium">AI Model</h3>
                <a
                  href="https://openrouter.ai/models"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:text-blue-600"
                >
                  Browse all models ↗
                </a>
              </div>
              <p className="text-accent-01 dark:text-accent-01 mb-3 text-sm">
                Enter or select an AI model to use for code generation
              </p>

              <div className="mb-3">
                <input
                  ref={modelInputRef}
                  type="text"
                  value={settings.model || ''}
                  onChange={handleModelChange}
                  placeholder="Enter or select model ID..."
                  className="border-light-decorative-01 dark:border-dark-decorative-01 dark:bg-dark-decorative-00 dark:text-dark-primary w-full rounded border p-2 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="mb-2">
                <label className="text-light-secondary dark:text-dark-secondary mb-1 block text-sm font-medium">
                  Recommended models (click to select):
                </label>
                <div className="flex flex-wrap gap-2">
                  {modelsList.map((model, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleModelSelection(model)}
                      className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        settings.model === model.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-light-background-01 text-light-primary hover:bg-light-background-02 dark:bg-dark-decorative-00 dark:text-dark-secondary dark:hover:bg-dark-decorative-01'
                      }`}
                      title={model.description}
                    >
                      {model.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded border p-4">
              <h3 className="mb-2 text-lg font-medium">Style Prompt</h3>
              <p className="text-accent-01 dark:text-accent-01 mb-3 text-sm">
                Choose a style for your AI-generated content
              </p>

              <div className="mb-3">
                <input
                  ref={stylePromptInputRef}
                  type="text"
                  value={settings.stylePrompt || ''}
                  onChange={handleStylePromptChange}
                  placeholder="Enter or select style prompt..."
                  className="border-light-decorative-01 dark:border-dark-decorative-01 dark:bg-dark-decorative-00 dark:text-dark-primary w-full rounded border p-2 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="mb-2">
                <label className="text-light-secondary dark:text-dark-secondary mb-1 block text-sm font-medium">
                  Suggestions (click to add):
                </label>
                <div className="flex flex-wrap gap-2">
                  {stylePromptSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleStylePromptSelection(suggestion)}
                      className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        settings.stylePrompt && settings.stylePrompt.startsWith(suggestion.name)
                          ? 'bg-blue-500 text-white'
                          : 'bg-light-background-01 text-light-primary hover:bg-light-background-02 dark:bg-dark-decorative-00 dark:text-dark-secondary dark:hover:bg-dark-decorative-01'
                      }`}
                      title={suggestion.description}
                    >
                      {suggestion.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded border p-4">
              <h3 className="mb-2 text-lg font-medium">User Prompt</h3>
              <p className="text-accent-01 dark:text-accent-01 mb-3 text-sm">
                Custom instructions to append to the system prompt
              </p>

              <div className="mb-2">
                <textarea
                  value={settings.userPrompt}
                  onChange={handleUserPromptChange}
                  placeholder="Enter custom instructions for the AI..."
                  className="border-light-decorative-01 dark:border-dark-decorative-01 dark:bg-dark-decorative-00 dark:text-dark-primary min-h-[100px] w-full rounded border p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Logout Button at the bottom */}
        {isAuthenticated && (
          <div className="border-light-decorative-01 dark:border-dark-decorative-00 dark:bg-dark-background-01 mt-8 w-full max-w-2xl rounded-md border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Account</h2>
            <div className="flex items-center justify-between">
              <p className="text-accent-01 dark:text-dark-secondary text-sm">
                Sign out from your account. Your vibes will still be in browser storage.
              </p>
              <button
                onClick={handleLogout}
                className="rounded bg-red-500 px-4 py-2 text-sm text-white transition-colors hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </SimpleAppLayout>
  );
}
