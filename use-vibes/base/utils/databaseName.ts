import { VibeBindings } from "../index.js";

/**
 * Constructs the full vibes database name from components.
 * Format: vf-{titleId}-{installId}-{baseName}
 */
export function constructVibesDatabaseName(bindings: VibeBindings, baseName: string): string {
  return `vf-${bindings.appSlug}-${bindings.userSlug}-${baseName}`;
}
