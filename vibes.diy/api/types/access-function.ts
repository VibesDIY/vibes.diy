/**
 * Firefly access function API types.
 *
 * The access function runs server-side on every write (including deletes).
 * It validates the write, routes the document to channels, and declares
 * how the write affects the materialized grant state.
 *
 * See docs/superpowers/specs/2026-05-31-firefly-access-function.html
 */

export interface UserContext {
  userSlug: string;
  displayName?: string;
}

export interface Helpers {
  requireAccess(channelId: string): void;
  requireRole(roleName: string): void;
}

export interface AccessDescriptor {
  channels?: string[];
  members?: Record<string, string[]>; // roleName → userSlug[]
  grant?: {
    users?: Record<string, string[]>; // userSlug → channelId[]
    roles?: Record<string, string[]>; // roleName → channelId[]
    public?: string[];
  };
  expiry?: string | number | null;
  allowAnonymous?: boolean;
}

export type AccessFunction = (doc: unknown, oldDoc: unknown, user: UserContext | null, ctx: Helpers) => AccessDescriptor;
