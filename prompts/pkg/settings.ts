/**
 * User settings for the application
 */
export interface UserSettings {
  /** Document ID for the settings document */
  _id: string;

  /** Custom style prompt for UI generation */
  stylePrompt?: string;

  /** Custom user instructions to append to the system prompt */
  userPrompt?: string;

  /** AI model to use for code generation */
  model?: string;

  /** Whether to show the per‑chat model picker in the chat UI */
  showModelPickerInChat?: boolean; // default false

  /** Pre-resolved skill names chosen for this app (from pre-allocation). */
  skills?: string[];

  /** Human-readable app title (from pre-allocation or user edit). */
  title?: string;

  /** Whether to include a demo-data button. Default false. */
  demoData?: boolean;
}
