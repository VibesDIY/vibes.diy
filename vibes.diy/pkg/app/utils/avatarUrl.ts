export function avatarRouteForHandle(handle?: string): string | undefined {
  const slug = handle?.trim();
  if (!slug) return undefined;
  return `/u/${encodeURIComponent(slug)}/avatar`;
}
