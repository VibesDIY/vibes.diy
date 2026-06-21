import { extractExportSource } from "./access-extract.js";

export interface AccessUser {
  userHandle: string;
  displayName?: string;
  isOwner: boolean;
}
export interface AccessGrants {
  channels: string[];
  publicChannels: string[];
  roles: string[];
}
export interface AccessCtx {
  requireAccess(channelId: string): void;
  requireRole(roleName: string): void;
}

// Mirrors the production QuickJS helpers (cf-serve.ts / workers/access-fn.ts):
// adminMode no-ops; anon throws "authentication required" BEFORE membership.
export function makeClientCtx(user: AccessUser | null, grants: AccessGrants, adminMode: boolean): AccessCtx {
  return {
    requireAccess(channelId: string): void {
      if (adminMode) return;
      if (!user) throw { forbidden: "authentication required" };
      if (!grants.channels.includes(channelId)) throw { forbidden: `not in channel: ${channelId}` };
    },
    requireRole(roleName: string): void {
      if (adminMode) return;
      if (!user) throw { forbidden: "authentication required" };
      if (!grants.roles.includes(roleName)) throw { forbidden: `not in role: ${roleName}` };
    },
  };
}
