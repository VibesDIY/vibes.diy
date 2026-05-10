// RFC 7232 helpers for strong ETag formatting and If-None-Match parsing.

export function quoteEtag(tag: string): string {
  return `"${tag}"`;
}

// If-None-Match accepts a comma-separated list of ETags or `*`.
// Strong/weak prefix is ignored at our layer — we mint strong ETags, so
// any candidate that resolves to the same quoted tag counts as a match.
export function etagMatches(ifNoneMatch: string, etag: string): boolean {
  const trimmed = ifNoneMatch.trim();
  if (trimmed === "*") return true;
  for (const candidate of trimmed.split(",")) {
    const c = candidate.trim().replace(/^W\//, "");
    if (c === etag) return true;
  }
  return false;
}
