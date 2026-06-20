import { ClerkClaim } from "@vibes.diy/api-types";

// Derive a human display name from Clerk claims, single source of truth for the
// who-am-i / list-members / get-app-by-fsid precedence: nick → name →
// "first last" → email.
export function deriveDisplayName(claims: ClerkClaim): string {
  const p = claims.params;
  if (p.nick !== undefined && p.nick.trim() !== "") return p.nick.trim();
  if (p.name !== null && p.name.trim() !== "") return p.name.trim();
  const composed = `${p.first} ${p.last}`.trim();
  if (composed !== "") return composed;
  return p.email;
}
