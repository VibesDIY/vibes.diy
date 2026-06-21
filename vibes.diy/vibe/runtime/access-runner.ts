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

export type WriteVerdict =
  | { ok: true }
  | { ok: false; reason: string; code: "access-denied" | "unreadable" }
  | { unknown: true; reason: string };

export interface EvaluateWriteArgs {
  source: string;
  dbName: string;
  doc: unknown;
  oldDoc: unknown;
  user: AccessUser | null;
  grants: AccessGrants;
  adminMode: boolean;
}

type Invoker = (doc: unknown, oldDoc: unknown, user: AccessUser | null, ctx: AccessCtx) => unknown;

// Mirrors workers/access-fn.ts:150-158 — named fn / anon fn / arrow / legacy body.
function buildInvoker(extracted: string): Invoker {
  const cleanSource = extracted.replace(/export\s+/g, "").replace(/^default\s+/, "");
  const fnNameMatch = cleanSource.match(/^function\s+(\w+)\s*\(/);
  const isAnonymousFnOrArrow = /^function\s*\(/.test(cleanSource) || /^\(/.test(cleanSource) || /^\w+\s*=>/.test(cleanSource);
  const body = fnNameMatch
    ? `${cleanSource}\n; return ${fnNameMatch[1]}(doc, oldDoc, user, ctx);`
    : isAnonymousFnOrArrow
      ? `const __accessFn = ${cleanSource}\n; return __accessFn(doc, oldDoc, user, ctx);`
      : `return (function () { ${cleanSource} })();`;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function("doc", "oldDoc", "user", "ctx", body) as Invoker;
}

function forbiddenReason(err: unknown): string | null {
  if (err && typeof err === "object" && "forbidden" in err) return String((err as Record<string, unknown>).forbidden);
  if (typeof err === "string") return err;
  return null;
}

export function evaluateWrite(args: EvaluateWriteArgs): WriteVerdict {
  const { source, dbName, doc, oldDoc, user, grants, adminMode } = args;

  const extracted = extractExportSource(source, dbName);
  if (extracted === undefined) return { unknown: true, reason: "access function not found" };

  let invoker: Invoker;
  try {
    invoker = buildInvoker(extracted);
  } catch {
    return { unknown: true, reason: "access function did not compile" };
  }

  const ctx = makeClientCtx(user, grants, adminMode);
  let result: unknown;
  try {
    result = invoker(doc, oldDoc, user, ctx);
  } catch (err) {
    const reason = forbiddenReason(err);
    if (reason === null) return { unknown: true, reason: "access function threw a non-forbidden error" };
    return { ok: false, reason, code: "access-denied" };
  }

  if (result && typeof (result as { then?: unknown }).then === "function") {
    return { unknown: true, reason: "async access function" };
  }

  const descriptor = (result ?? {}) as { channels?: unknown; allowAnonymous?: unknown };

  // enforceAllowAnonymous (access-function.ts:29-33)
  if (user === null && !descriptor.allowAnonymous) {
    return { ok: false, reason: "authentication required", code: "access-denied" };
  }

  // isReadableResult (access-function.ts:45-47)
  if (!(Array.isArray(descriptor.channels) && descriptor.channels.length > 0)) {
    return { ok: false, reason: "unreadable write", code: "unreadable" };
  }

  return { ok: true };
}

export interface CanSeeArgs {
  doc: { _id: string };
  // Stored access-fn output channels by docId (NOT a field on the doc).
  outputChannels: Map<string, string[]> | undefined;
  grants: AccessGrants;
  adminOverride: boolean;
}

// Mirrors filterDocsByChannel (channel-read-filter.ts): admin sees all; else a
// doc is visible iff its STORED output channels intersect effective ∪ public.
// A doc with no stored channels is invisible. No owner read bypass.
export function canSeeDoc({ doc, outputChannels, grants, adminOverride }: CanSeeArgs): boolean {
  if (adminOverride) return true;
  const channels = outputChannels?.get(doc._id);
  if (!channels) return false;
  return channels.some((ch) => grants.channels.includes(ch) || grants.publicChannels.includes(ch));
}
