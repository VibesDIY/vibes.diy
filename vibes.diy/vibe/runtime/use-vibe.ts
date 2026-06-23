import { useMemo } from "react";
import { useVibeContext } from "./VibeContext.js";
import { evaluateWrite, type AccessGrants, type AccessUser } from "./access-runner.js";
import { useGraceDegraded } from "./use-vibe-grace.js";

export interface CanVerdict {
  readonly ok: boolean;
  readonly reason?: string;
}

// Structurally identical to AccessUser (access-runner.ts): `me` is returned as
// UseVibeMe and also passed straight into evaluateWrite as AccessUser. Keep the
// two shapes in lockstep — if AccessUser gains a field, mirror it here.
export interface UseVibeMe {
  readonly userHandle: string;
  readonly displayName?: string;
  readonly isOwner: boolean;
}

export interface UseVibeResult {
  /** Resolved viewer identity, or null when anonymous. */
  readonly me: UseVibeMe | null;
  /** True once identity AND this db's access source have resolved (or the
   *  grace window degraded a never-arriving source to optimistic). Gate
   *  access-sensitive UI on this to avoid a half-resolved flash. */
  readonly ready: boolean;
  readonly can: {
    create(doc: unknown): CanVerdict;
    edit(doc: unknown): CanVerdict;
    delete(doc: unknown): CanVerdict;
  };
}

// Must stay a module constant: `grants` (below) uses it as the no-grants
// fallback and is a dependency of the `can` useMemo. Inlining this as a literal
// would mint a fresh object every render and silently defeat that memo.
const EMPTY_GRANTS: AccessGrants = { channels: [], publicChannels: [], roles: [] };

export function useVibe(dbName: string): UseVibeResult {
  const { mountParams, accessFnSources } = useVibeContext();
  const env = mountParams.viewerEnv;

  const identityReady = env !== undefined;
  // Effective binding: exact dbName match, else the wildcard "*" (a default-export
  // access.js applies to every db). Mirrors the server's `namedCids.get(dbName) ??
  // wildcardCid` (who-am-i.ts resolveGrants) so a default-export app is actually
  // gated, not optimistically allowed. `bindingName` is what the runner extracts
  // by ("*" → default export, else the named export); grants stay keyed by the
  // concrete dbName below (the server stores outputs under concrete names).
  const bindings = mountParams.accessFnBindings;
  const binding = bindings?.find((b) => b.dbName === dbName) ?? bindings?.find((b) => b.dbName === "*");
  const cid = binding?.accessFnCid;
  const bindingName = binding?.dbName ?? dbName;
  const hasBinding = cid !== undefined;
  const sourcePresent = hasBinding && accessFnSources.has(cid);
  const pending = hasBinding && !sourcePresent;

  const graceDegraded = useGraceDegraded(cid, pending);

  const sourceReady = !hasBinding || sourcePresent || graceDegraded;
  const ready = identityReady && sourceReady;

  // A real source string only when the cache holds one; null (resolved-unknown),
  // absent (no binding), or grace-degraded all leave this undefined → optimistic.
  const source = hasBinding && sourcePresent ? accessFnSources.get(cid) : undefined;

  const me: UseVibeMe | null = useMemo(
    () => (env?.viewer ? { ...env.viewer, isOwner: env.isOwner ?? false } : null),
    [env?.viewer, env?.isOwner]
  );
  // Fall back to the wildcard `*` entry when this db has no concrete grants yet
  // (a fresh vibe under a default-export access fn): the server emits a
  // seed-only grants["*"] carrying the owner's seed roles, so the owner's first
  // create/edit is predicted correctly. A concrete grants[dbName] always wins.
  const grants: AccessGrants = env?.grants?.[dbName] ?? env?.grants?.["*"] ?? EMPTY_GRANTS;
  const adminMode = env?.adminMode ?? false;

  const can = useMemo(() => {
    const user: AccessUser | null = me;
    function verdict(doc: unknown, oldDoc: unknown): CanVerdict {
      if (!ready) return { ok: false, reason: "pending" };
      if (typeof source !== "string") return { ok: true }; // optimistic
      const v = evaluateWrite({ source, dbName: bindingName, doc, oldDoc, user, grants, adminMode });
      if ("unknown" in v) {
        if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
          // Telemetry seam (spec): full unknown-rate metric is a later item.
          console.warn(`[useVibe] unknown verdict for "${dbName}": ${v.reason}`);
        }
        return { ok: true, reason: v.reason };
      }
      return v.ok ? { ok: true } : { ok: false, reason: v.reason };
    }
    return {
      create: (doc: unknown) => verdict(doc, null),
      edit: (doc: unknown) => verdict(doc, doc),
      delete: (doc: unknown) => verdict(doc, doc),
    };
  }, [ready, source, bindingName, me, grants, adminMode]);

  return { me, ready, can };
}
