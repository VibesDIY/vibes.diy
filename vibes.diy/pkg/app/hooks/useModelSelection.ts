import { useState } from "react";
import { useFireproof } from "use-fireproof";
import { DEFAULT_CODING_MODEL, type UserSettings } from "@vibes.diy/prompts";
import { VibesDiyEnv } from "../config/env.js";

/**
 * Hook to manage model selection with global settings fallback
 * Shared by useNewSessionChat and useSimpleChat
 */
export function useModelSelection() {
  const { useDocument } = useFireproof(VibesDiyEnv.SETTINGS_DBNAME());
  const { doc: settingsDoc } = useDocument<UserSettings>({
    _id: "user_settings",
  });

  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    undefined,
  );

  // Determine effective model: user selection > global setting > default
  const effectiveModel =
    selectedModel || settingsDoc?.model || DEFAULT_CODING_MODEL;

  return {
    selectedModel,
    setSelectedModel,
    effectiveModel,
    globalModel: settingsDoc?.model || DEFAULT_CODING_MODEL,
    showModelPickerInChat: settingsDoc?.showModelPickerInChat || false,
    settingsDoc, // Expose for consumers that need other settings properties
  };
}
