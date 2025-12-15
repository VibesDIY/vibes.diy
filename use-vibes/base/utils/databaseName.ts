/**
 * Constructs the full vibes database name from components.
 * Format: vf-{titleId}-{installId}-{baseName}
 */
export function constructVibesDatabaseName(
  titleId: string,
  installId: string,
  baseName: string
): string {
  return `vf-${titleId}-${installId}-${baseName}`;
}
