// Direct-channel userSlug helpers.
//
// A direct-channel slug is a special userSlug of the form "_d.<a>.<b>" where
// <a> and <b> are the two participant userSlugs in lexicographic order.
// Storing them sorted ensures alice→bob and bob→alice resolve to the same
// channel. The slug is used as the `userSlug` field in putDoc/queryDocs/etc.
// to gate the conversation to only the two participants.

const DM_PREFIX = "_d.";

/** Build a canonical direct-channel slug from two participant userSlugs. */
export function directChannelUserSlug(slugA: string, slugB: string): string {
  const [first, second] = slugA < slugB ? [slugA, slugB] : [slugB, slugA];
  return `${DM_PREFIX}${first}.${second}`;
}

/**
 * Return true if `userSlug` looks like a direct-channel slug.
 * Checks only the prefix — does not validate participant slugs.
 */
export function isDirectChannel(userSlug: string): boolean {
  return userSlug.startsWith(DM_PREFIX);
}

/**
 * Extract the two participant userSlugs from a direct-channel slug.
 * Returns `null` if the slug is not a well-formed direct-channel slug.
 *
 * Assumes the slug was produced by `directChannelUserSlug`, so the two
 * participants are separated by a single "." after the "_d." prefix.
 * Because participant slugs may themselves contain dots, we split on the
 * FIRST occurrence of "." after the prefix (i.e. "slug-a" is everything up
 * to the boundary established at creation time).
 *
 * In practice vibes.diy userSlugs are alphanumeric-dash, no dots, so a
 * simple two-part split on the separator after the prefix is unambiguous.
 */
export function directChannelParticipants(channelUserSlug: string): [string, string] | null {
  if (!isDirectChannel(channelUserSlug)) return null;
  const body = channelUserSlug.slice(DM_PREFIX.length);
  const dotIdx = body.indexOf(".");
  if (dotIdx < 1 || dotIdx === body.length - 1) return null;
  return [body.slice(0, dotIdx), body.slice(dotIdx + 1)];
}
