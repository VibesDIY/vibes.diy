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

/**
 * Builds the Helpers ctx passed to the access function during evaluation.
 *
 * Both helpers throw immediately when user is null — any branch that calls
 * them is protected against anonymous access without a separate null check.
 */
export function makeHelpers(user: UserContext | null): Helpers {
  return {
    requireAccess(channelId: string): void {
      if (user === null) {
        throw new ForbiddenError(`not in channel: ${channelId}`);
      }
      // Phase 3: check materialized channel membership for user.userHandle
      // For now this always passes for authenticated users.
    },
    requireRole(roleName: string): void {
      if (user === null) {
        throw new ForbiddenError(`not in role: ${roleName}`);
      }
      // Phase 3: check materialized role membership for user.userHandle
      // For now this always passes for authenticated users.
    },
  };
}

export class ForbiddenError extends Error {
  readonly forbidden: string;

  constructor(reason: string) {
    super(reason);
    this.name = "ForbiddenError";
    this.forbidden = reason;
  }
}
