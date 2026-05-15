export function avatarRouteForUserSlug(userSlug?: string): string | undefined {
  const slug = userSlug?.trim();
  if (!slug) return undefined;
  return `/u/${encodeURIComponent(slug)}/avatar`;
}
