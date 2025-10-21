/**
 * Vibesbox utilities and helper functions
 */

export const DEFAULT_VIBE_SLUG = "quick-cello-8104";
export const VIBES_VERSION_PARAM = "v_vibes";
export const IMPORT_MAP_PLACEHOLDER = "{{IMPORT_MAP}}";

/**
 * Replace template placeholders in HTML
 */
export function replacePlaceholders(
  html: string,
  replacements: Record<string, string>,
): string {
  let result = html;
  for (const [placeholder, value] of Object.entries(replacements)) {
    const regex = new RegExp(
      placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "g",
    );
    result = result.replace(regex, value);
  }
  return result;
}
