/**
 * Vibesbox utilities and helper functions
 */

export const DEFAULT_VIBE_SLUG = "quick-cello-8104";
export const DEFAULT_FIREPROOF_VERSION = "0.23.14";
export const FIREPROOF_VERSION_PARAM = "v_fp";
export const FIREPROOF_VERSION_PLACEHOLDER = "{{FIREPROOF_VERSION}}";

/**
 * Validate semver format
 */
export function isValidSemver(version: string | null): boolean {
  if (!version) return false;
  const semverPattern =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;
  return semverPattern.test(version);
}

/**
 * Get fireproof version from URL parameter with validation
 */
export function getFireproofVersion(url: URL): string {
  const versionParam = url.searchParams.get(FIREPROOF_VERSION_PARAM);
  return isValidSemver(versionParam)
    ? versionParam!
    : DEFAULT_FIREPROOF_VERSION;
}

/**
 * Replace template placeholders in HTML
 */
export function replacePlaceholders(
  html: string,
  replacements: Record<string, string>
): string {
  let result = html;
  for (const [placeholder, value] of Object.entries(replacements)) {
    const regex = new RegExp(
      placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "g"
    );
    result = result.replace(regex, value);
  }
  return result;
}