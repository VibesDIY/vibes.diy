/**
 * Generates CSS custom property declarations from typed token objects.
 * Internal module — not exported from the public API.
 */

import { colors, semantic } from "./tokens.js";

function flattenToVars(prefix: string, obj: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      lines.push(`  --${prefix}-${kebab(key)}: ${value};`);
    } else if (typeof value === "object" && value !== null) {
      lines.push(...flattenToVars(`${prefix}-${kebab(key)}`, value as Record<string, unknown>));
    }
  }
  return lines;
}

function kebab(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function vibesBaseVars(): string[] {
  return Object.entries(colors).map(([key, value]) => `  --vibes-${kebab(key)}: ${value};`);
}

function vibesSemanticVars(theme: Record<string, unknown>): string[] {
  return flattenToVars("vibes", theme);
}

/**
 * Generate :root CSS variable block + dark mode overrides from tokens.
 */
export function generateCSSVariables(): string {
  const lightRoot = [
    ":root {",
    ...vibesBaseVars(),
    ...vibesSemanticVars(semantic.light),
    "}",
  ].join("\n");

  const darkOverrides = [
    "@media (prefers-color-scheme: dark) {",
    "  :root {",
    ...vibesSemanticVars(semantic.dark).map((l) => `  ${l}`),
    "  }",
    "}",
  ].join("\n");

  return `${lightRoot}\n\n${darkOverrides}`;
}
