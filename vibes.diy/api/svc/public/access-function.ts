/**
 * Firefly access function enforcement.
 *
 * enforceAllowAnonymous: gates anonymous writes behind an explicit opt-in.
 * If user is null and the access function return value does not set
 * allowAnonymous: true, the write is rejected with { forbidden: ... }.
 *
 * makeHelpers: builds the Helpers ctx passed to the access function.
 * requireAccess and requireRole both throw immediately when user is null —
 * any branch that calls them is protected against anonymous access without
 * a separate null check.
 *
 * See docs/superpowers/specs/2026-05-31-firefly-access-function.html
 */

import type { AccessDescriptor, AccessFunction, Helpers, UserContext } from "@vibes.diy/api-types";

export type { AccessDescriptor, AccessFunction, Helpers, UserContext };

/**
 * Enforces the allowAnonymous contract.
 *
 * Call this after evaluating the access function when user may be null.
 * Throws a ForbiddenError if user is null and the result does not
 * explicitly set allowAnonymous: true.
 *
 * When user is non-null this is a no-op regardless of allowAnonymous.
 */
export function enforceAllowAnonymous(result: AccessDescriptor, user: UserContext | null): void {
  if (user === null && !result.allowAnonymous) {
    throw new ForbiddenError("authentication required");
  }
}

interface GrantState {
  members: Record<string, string[]>;
  roleGrants: Record<string, string[]>;
  userGrants: Record<string, string[]>;
}

export function makeHelpers(user: UserContext | null, grantState?: GrantState): Helpers {
  const gs: GrantState = grantState ?? { members: {}, roleGrants: {}, userGrants: {} };

  function resolveChannels(userSlug: string): Set<string> {
    const channels = new Set<string>();
    const direct = gs.userGrants[userSlug];
    if (direct) for (const ch of direct) channels.add(ch);
    for (const [role, members] of Object.entries(gs.members)) {
      if (members.includes(userSlug)) {
        const roleChannels = gs.roleGrants[role];
        if (roleChannels) for (const ch of roleChannels) channels.add(ch);
      }
    }
    return channels;
  }

  return {
    requireAccess(channelId: string): void {
      if (user === null) {
        throw new ForbiddenError(`not in channel: ${channelId}`);
      }
      const channels = resolveChannels(user.userHandle);
      if (!channels.has(channelId)) {
        throw new ForbiddenError(`not in channel: ${channelId}`);
      }
    },
    requireRole(roleName: string): void {
      if (user === null) {
        throw new ForbiddenError(`not in role: ${roleName}`);
      }
      const roleMembers = gs.members[roleName];
      if (!roleMembers?.includes(user.userHandle)) {
        throw new ForbiddenError(`not in role: ${roleName}`);
      }
    },
  };
}

/**
 * Extract a single function from a multi-export access.js source.
 * For "*" (default), extracts `export default function(...)` or `export default (...) => { ... }`.
 * For a named dbName, extracts `export function <dbName>(...)`.
 * Also supports `export { localName as "dbName" }` for non-identifier db names.
 * Brace-counts to find the closing `}`. Returns undefined if not found.
 */
export function extractExportSource(fullSource: string, bindingDbName: string): string | undefined {
  if (bindingDbName === "*") {
    return extractByPattern(
      fullSource,
      /export\s+default\s+(?:function\s*(?:\w+\s*)?\([^)]*\)\s*\{|\([^)]*\)\s*=>\s*\{|\w+\s*=>\s*\{)/,
      true
    );
  }

  const directPattern = new RegExp(`export\\s+function\\s+${escapeRegExp(bindingDbName)}\\s*\\([^)]*\\)\\s*\\{`);
  const direct = extractByPattern(fullSource, directPattern, false);
  if (direct) return direct;

  const asMatch = fullSource.match(new RegExp(`export\\s*\\{\\s*(\\w+)\\s+as\\s+["']${escapeRegExp(bindingDbName)}["']\\s*\\}`));
  if (asMatch) {
    const localName = asMatch[1];
    const fnPattern = new RegExp(`function\\s+${localName}\\s*\\([^)]*\\)\\s*\\{`);
    return extractByPattern(fullSource, fnPattern, false);
  }

  return undefined;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractByPattern(fullSource: string, pattern: RegExp, isDefault: boolean): string | undefined {
  const match = fullSource.match(pattern);
  if (!match || match.index === undefined) return undefined;
  const start = match.index;
  let depth = 0;
  let end = start;
  for (let i = start; i < fullSource.length; i++) {
    if (fullSource[i] === "{") depth++;
    if (fullSource[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  let extracted = fullSource.slice(start, end).replace(/^export\s+/, "");
  if (isDefault) extracted = extracted.replace(/^default\s+/, "");
  return extracted;
}

export class ForbiddenError extends Error {
  readonly forbidden: string;

  constructor(reason: string) {
    super(reason);
    this.name = "ForbiddenError";
    this.forbidden = reason;
  }
}
