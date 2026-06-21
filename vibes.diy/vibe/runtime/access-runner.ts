import { exception2Result } from "@adviser/cement";
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
      if (user === null) throw { forbidden: "authentication required" };
      if (!grants.channels.includes(channelId)) throw { forbidden: `not in channel: ${channelId}` };
    },
    requireRole(roleName: string): void {
      if (adminMode) return;
      if (user === null) throw { forbidden: "authentication required" };
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
  // extractExportSource already strips leading export/default; these guards
  // mirror the DO's redundant strip (access-fn.ts:150) so behavior matches exactly.
  const cleanSource = extracted.replace(/export\s+/g, "").replace(/^default\s+/, "");
  const fnNameMatch = cleanSource.match(/^function\s+(\w+)\s*\(/);
  const isAnonymousFnOrArrow = /^function\s*\(/.test(cleanSource) || /^\(/.test(cleanSource) || /^\w+\s*=>/.test(cleanSource);
  const body = fnNameMatch
    ? `${cleanSource}\n; return ${fnNameMatch[1]}(doc, oldDoc, user, ctx);`
    : isAnonymousFnOrArrow
      ? `const __accessFn = ${cleanSource}\n; return __accessFn(doc, oldDoc, user, ctx);`
      : `return (function () { ${cleanSource} })();`;
  return new Function("doc", "oldDoc", "user", "ctx", body) as Invoker;
}

function forbiddenReason(err: unknown): string | null {
  if (typeof err === "object" && err !== null && "forbidden" in err) return String((err as Record<string, unknown>).forbidden);
  if (typeof err === "string") return err;
  return null;
}

export function evaluateWrite(args: EvaluateWriteArgs): WriteVerdict {
  const { source, dbName, doc, oldDoc, user, grants, adminMode } = args;

  const extracted = extractExportSource(source, dbName);
  if (extracted === undefined) return { unknown: true, reason: "access function not found" };

  const rInvoker = exception2Result(() => buildInvoker(extracted));
  if (rInvoker.isErr()) return { unknown: true, reason: "access function did not compile" };
  const invoker = rInvoker.Ok();

  const ctx = makeClientCtx(user, grants, adminMode);
  // Intentional try/catch (not exception2Result): the runner must stay
  // synchronous so `can.*` returns a verdict without awaiting, and it must
  // (a) detect a *returned* Promise to report `unknown: "async"` — which
  // exception2Result would auto-await, forcing this function async — and (b)
  // preserve the raw thrown value so a non-Error `{ forbidden }` (and the
  // server's rarer thrown-string path) survives intact for forbiddenReason.
  let result: unknown;
  try {
    result = invoker(doc, oldDoc, user, ctx);
  } catch (err) {
    const reason = forbiddenReason(err);
    if (reason === null) return { unknown: true, reason: "access function threw a non-forbidden error" };
    return { ok: false, reason, code: "access-denied" };
  }

  if (result !== null && result !== undefined && typeof (result as { then?: unknown }).then === "function") {
    return { unknown: true, reason: "async access function" };
  }

  const descriptor = (result ?? {}) as { channels?: unknown; allowAnonymous?: unknown };

  // enforceAllowAnonymous (access-function.ts:29-33): only allowAnonymous === true opts in.
  if (user === null && descriptor.allowAnonymous !== true) {
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

// Mirrors filterDocsByChannel (channel-read-filter.ts): admin sees all; when
// there are NO access-fn outputs at all, the server passes every doc through
// (`outputRows.length === 0 → return docs`), so we do too — hiding everything on
// cold/backfill would diverge from production reads. Otherwise a doc is visible
// iff its STORED output channels intersect effective ∪ public; a doc absent from
// the output map is invisible. No owner read bypass.
//
// `outputChannels === undefined` here means the server-side "no outputs" cold
// start, NOT "not delivered to the client yet". Delivery-pending is a distinct
// state the slice-2 hook must model with a readiness flag — it must not pass
// `undefined` to mean "still loading" (that would read as cold-start = show
// all). Keep "not ready" as unknown/pending at the hook, never a verdict here.
export function canSeeDoc({ doc, outputChannels, grants, adminOverride }: CanSeeArgs): boolean {
  if (adminOverride) return true;
  if (outputChannels === undefined || outputChannels.size === 0) return true;
  const channels = outputChannels.get(doc._id);
  if (channels === undefined) return false;
  return channels.some((ch) => grants.channels.includes(ch) || grants.publicChannels.includes(ch));
}
