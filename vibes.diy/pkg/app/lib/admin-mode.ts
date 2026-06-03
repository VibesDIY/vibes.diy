export function adminModeStorageKey(ownerHandle: string, appSlug: string): string {
  return `adminMode:${ownerHandle}/${appSlug}`;
}
