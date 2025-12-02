import type { ChangeEvent } from "react";
import React, { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFireproof } from "use-fireproof";
import { useAuth as useClerkAuth, useClerk } from "@clerk/clerk-react";
import { BrutalistCard, VibesButton } from "@vibes.diy/use-vibes-base";
import modelsList from "../data/models.json" with { type: "json" };
import { VibesDiyEnv } from "../config/env.js";
import { UserSettings, stylePrompts } from "@vibes.diy/prompts";
import LoggedOutView from "../components/LoggedOutView.js";

export function meta() {
  return [
    { title: "Settings - Vibes DIY" },
    { name: "description", content: "Settings for AI App Builder" },
  ];
}

function SettingsContent() {
  const navigate = useNavigate();
  // Use the main database directly instead of through useSession
  const { useDocument } = useFireproof(VibesDiyEnv.SETTINGS_DBNAME());
  const { isSignedIn: isAuthenticated } = useClerkAuth();
  const { signOut } = useClerk();

  const {
    doc: settings,
    merge: mergeSettings,
    save: saveSettings,
  } = useDocument<UserSettings>({
    _id: "user_settings",
    stylePrompt: "",
    userPrompt: "",
    model: "",
  });

  // State to track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const stylePromptInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  const handleStylePromptChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      mergeSettings({ stylePrompt: e.target.value });
      setHasUnsavedChanges(true); // Track change
    },
    [mergeSettings],
  );

  const handleStylePromptSelection = useCallback(
    (suggestion: { name: string; prompt: string }) => {
      const fullPrompt = `${suggestion.name} (${suggestion.prompt})`;
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
    [mergeSettings],
  );

  const handleModelChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      mergeSettings({ model: e.target.value });
      setHasUnsavedChanges(true); // Track change
    },
    [mergeSettings],
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
    [mergeSettings],
  );

  const handleUserPromptChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      mergeSettings({ userPrompt: e.target.value });
      setHasUnsavedChanges(true); // Track change
    },
    [mergeSettings],
  );

  const handleSubmit = useCallback(async () => {
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await saveSettings({ ...settings });
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      navigate("/");
    } catch (err) {
      setSaveError((err as Error).message || "Failed to save settings");
    }
  }, [saveSettings, settings, navigate]);

  const handleLogout = useCallback(async () => {
    // Sign out with Clerk
    await signOut();
    // Navigate to home page after sign out
    navigate("/");
  }, [signOut, navigate]);

  const handleShowModelPickerInChatChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      mergeSettings({ showModelPickerInChat: e.target.checked });
      setHasUnsavedChanges(true); // Track change
    },
    [mergeSettings],
  );

  return (
    <div className="page-grid-background grid-background min-h-screen min-h-[100svh] min-h-[100dvh] w-full">
      <div className="flex-1 px-8 py-8">
        <div
          style={{
            maxWidth: "1000px",
            width: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {/* Header */}
          <BrutalistCard size="lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2">Settings</h1>
                <p className="text-lg">Configure your AI preferences</p>
              </div>
              <VibesButton
                variant="blue"
                onClick={handleSubmit}
                disabled={!hasUnsavedChanges}
              >
                {saveSuccess ? "Saved!" : "Save"}
              </VibesButton>
            </div>
          </BrutalistCard>

          {/* Save Messages */}
          {saveError && (
            <BrutalistCard size="md">
              <p className="text-red-600 font-medium">{saveError}</p>
            </BrutalistCard>
          )}

          {/* AI Model Section */}
          <BrutalistCard size="md">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-2xl font-bold">AI Model</h3>
              <a
                href="https://openrouter.ai/models"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:text-blue-600"
              >
                Browse all models ↗
              </a>
            </div>
            <p
              className="mb-4"
              style={{ color: "var(--vibes-text-secondary)" }}
            >
              Enter or select an AI model to use for code generation
            </p>

            <div className="mb-4">
              <input
                ref={modelInputRef}
                type="text"
                value={settings.model || ""}
                onChange={handleModelChange}
                placeholder="Enter or select model ID..."
                className="w-full rounded border-2 p-3 font-mono text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  borderColor: "var(--vibes-border-input)",
                  background: "var(--vibes-bg-input)",
                  color: "var(--vibes-text-primary)",
                }}
              />
            </div>

            <div className="mb-4">
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: "var(--vibes-text-primary)" }}
              >
                Recommended models:
              </label>
              <div className="flex flex-wrap gap-2">
                {modelsList.map((model, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleModelSelection(model)}
                    className={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      settings.model === model.id
                        ? "bg-blue-600 text-white dark:bg-purple-500"
                        : ""
                    }`}
                    style={
                      settings.model !== model.id
                        ? {
                            background: "var(--vibes-bg-secondary)",
                            color: "var(--vibes-text-primary)",
                          }
                        : {}
                    }
                    title={model.description}
                  >
                    {model.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Model picker visibility */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.showModelPickerInChat || false}
                  onChange={handleShowModelPickerInChatChange}
                  className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">Show model picker in chat</span>
              </label>
            </div>
          </BrutalistCard>

          {/* Style Prompt Section */}
          <BrutalistCard size="md">
            <h3 className="text-2xl font-bold mb-4">Style Prompt</h3>
            <p
              className="mb-4"
              style={{ color: "var(--vibes-text-secondary)" }}
            >
              Choose a style for your AI-generated content
            </p>

            <div className="mb-4">
              <input
                ref={stylePromptInputRef}
                type="text"
                value={settings.stylePrompt || ""}
                onChange={handleStylePromptChange}
                placeholder="Enter or select style prompt..."
                className="w-full rounded border-2 p-3 font-mono text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                style={{
                  borderColor: "var(--vibes-border-input)",
                  background: "var(--vibes-bg-input)",
                  color: "var(--vibes-text-primary)",
                }}
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium"
                style={{ color: "var(--vibes-text-primary)" }}
              >
                Suggestions:
              </label>
              <div className="flex flex-wrap gap-2">
                {stylePrompts.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleStylePromptSelection(suggestion)}
                    className={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      settings.stylePrompt &&
                      settings.stylePrompt.startsWith(suggestion.name)
                        ? "bg-blue-600 text-white dark:bg-purple-500"
                        : ""
                    }`}
                    style={
                      settings.stylePrompt &&
                      !settings.stylePrompt.startsWith(suggestion.name)
                        ? {
                            background: "var(--vibes-bg-secondary)",
                            color: "var(--vibes-text-primary)",
                          }
                        : {}
                    }
                    title={suggestion.prompt}
                  >
                    {suggestion.name}
                  </button>
                ))}
              </div>
            </div>
          </BrutalistCard>

          {/* User Prompt Section */}
          <BrutalistCard size="md">
            <h3 className="text-2xl font-bold mb-4">User Prompt</h3>
            <p
              className="mb-4"
              style={{ color: "var(--vibes-text-secondary)" }}
            >
              Custom instructions to append to the system prompt
            </p>

            <textarea
              value={settings.userPrompt}
              onChange={handleUserPromptChange}
              placeholder="Enter custom instructions for the AI..."
              className="w-full min-h-[120px] rounded border-2 p-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              style={{
                borderColor: "var(--vibes-border-input)",
                background: "var(--vibes-bg-input)",
                color: "var(--vibes-text-primary)",
              }}
            />
          </BrutalistCard>

          {/* Account Section */}
          {isAuthenticated && (
            <BrutalistCard size="md">
              <h2 className="text-2xl font-bold mb-4">Account</h2>
              <div className="flex items-center justify-between">
                <p style={{ color: "var(--vibes-text-secondary)" }}>
                  Sign out from your account. Your vibes will still be in
                  browser storage.
                </p>
                <VibesButton variant="red" onClick={handleLogout}>
                  Logout
                </VibesButton>
              </div>
            </BrutalistCard>
          )}
        </div>
      </div>
    </div>
  );
}

// Auth wrapper component
export default function Settings() {
  const { isSignedIn, isLoaded } = useClerkAuth();

  if (!isSignedIn) {
    return <LoggedOutView isLoaded={isLoaded} />;
  }

  return <SettingsContent />;
}
