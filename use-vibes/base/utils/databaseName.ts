/**
 * Constructs the full vibes database name from components.
 * Format: vf-{titleId}-{installId}-{baseName}
 */
export function constructVibesDatabaseName(
  titleId: string,
  installId: string,
  baseName = 'default'
): string {
  return `vf-${titleId}-${installId}-${baseName}`;
}
