export const RUNTIME_PREVIEW_IFRAME_ALLOW_TOKENS = [
  "autoplay",
  "camera",
  "clipboard-write",
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

// Build the copy-ready embed snippet for the Share surface. Derived from the
// same policy tokens as the live iframes so the pasted markup can never drift
// from what the runtime actually runs under.
export function buildEmbedSnippet({ embedUrl, title }: { embedUrl: string; title: string }): string {
  // Escape double quotes so a title with quotes can't break out of the attribute.
  const safeTitle = title.replace(/"/g, "&quot;");
  return [
    `<iframe`,
    `  src="${embedUrl}"`,
    `  style="width:100%;aspect-ratio:16/9;border:0"`,
    `  sandbox="${RUNTIME_PREVIEW_IFRAME_SANDBOX}"`,
    `  allow="${RUNTIME_PREVIEW_IFRAME_ALLOW}"`,
    `  title="${safeTitle}"`,
    `  loading="lazy"`,
    `></iframe>`,
  ].join("\n");
}
