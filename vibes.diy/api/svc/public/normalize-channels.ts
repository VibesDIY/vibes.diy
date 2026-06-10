// Channels come from the access fn as an unconstrained string[]. An empty or
// whitespace-only channel would build a broken routing key (ownerHandle/appSlug/)
// and — because `channel ?? dbName` only falls through on null/undefined, NOT ""
// — would NOT fall back to the real dbName. Normalize before both subscribe-key
// construction and notify fan-out so subscriber keys and notify keys stay in sync.
export function normalizeChannels(channels: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const c of channels) {
    const t = c.trim();
    if (t.length > 0) seen.add(t);
  }
  return [...seen];
}
