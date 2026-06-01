export const RUNTIME_PREVIEW_IFRAME_ALLOW_TOKENS = [
  "autoplay",
  "camera",
  "encrypted-media",
  "microphone",
] as const;

export const RUNTIME_PREVIEW_IFRAME_ALLOW = RUNTIME_PREVIEW_IFRAME_ALLOW_TOKENS.join("; ");

export const RUNTIME_PREVIEW_IFRAME_SANDBOX_TOKENS = [
  "allow-scripts",
  "allow-same-origin",
  "allow-forms",
  "allow-modals",
  "allow-popups",
  "allow-popups-to-escape-sandbox",
] as const;

export const RUNTIME_PREVIEW_IFRAME_SANDBOX = RUNTIME_PREVIEW_IFRAME_SANDBOX_TOKENS.join(" ");
