/**
 * Firefly — drop-in useFireproof replacement backed by the vibes-diy API.
 *
 * Inline React hooks (no Fireproof dependency). Apps get this via the
 * import map: "use-fireproof" → "@vibes.diy/vibe-runtime".
 */

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { FireflyDatabase, type FireflyQueryDatabase } from "./firefly-database.js";
import {
  getOrCreateLocalDb,
  hasAuthedBefore,
  markAuthedBefore,
  migrateLocalToCloud,
  type MigrateFn,
} from "./firefly-local-database.js";
import { createEphemeralCoalescer } from "./merge-coalescer.js";
import type { VibeSandboxApi } from "./register-dependencies.js";
import type { DbAcl, AccessFunction } from "@vibes.diy/vibe-types";
import { useVibeContext } from "./VibeContext.js";
import type { ViewerEnv } from "./vibe.js";

export interface DatabaseAccess {
  readonly roles: ReadonlySet<string>;
  readonly channels: ReadonlySet<string>;
  hasRole(role: string): boolean;
  hasChannel(channel: string): boolean;
}

const EMPTY_ACCESS: DatabaseAccess = {
  roles: new Set<string>(),
  channels: new Set<string>(),
  hasRole: () => false,
  hasChannel: () => false,
};

// Stable per-db signature over the viewer's grants for one database.
// Sorted + de-duped so reordered who-am-i arrays (who-am-i builds them from
// Sets via Array.from without sorting) don't churn the key. Empty when the
// db has no grants (no-access-fn apps) — those keep the prior behaviour.
function grantsSignature(viewerEnv: ViewerEnv | undefined, dbName: string): string {
  const g = viewerEnv?.grants?.[dbName];
  if (!g) return "";
  const sig = (arr: readonly string[] | undefined) => [...new Set(arr ?? [])].sort().join(",");
  return `${sig(g.channels)}|${sig(g.publicChannels)}|${sig(g.roles)}`;
}

// Module-scoped state, set by registerFirefly()
let vibeApiRef: VibeSandboxApi | undefined;

// Cache FireflyDatabase instances by name so useMemo stability works
const dbCache = new Map<string, FireflyDatabase>();

function getOrCreateDb(name: string, acl?: DbAcl): FireflyDatabase {
  let db = dbCache.get(name);
  if (!db) {
    if (!vibeApiRef) {
      throw new Error("Firefly not initialized — registerFirefly() must be called before useFireproof()");
    }
    db = new FireflyDatabase(name, vibeApiRef, acl);
    dbCache.set(name, db);
  } else if (acl) {
    db.applyAcl(acl);
  }
  return db;
}

/**
 * Register the Firefly system. Called by registerDependencies().
 *
 * Per-dbName subscription happens in the FireflyDatabase constructor — see
 * firefly-database.ts. Server-side fan-out is keyed on
 * (ownerHandle, appSlug, dbName), so subscribing once here with a hardcoded
 * dbName would only cover one channel; each useFireproof(name) call must
 * trigger its own subscribe.
 */
export async function registerFirefly(api: VibeSandboxApi): Promise<void> {
  vibeApiRef = api;
}

/**
 * List all database names for the current app (owner only).
 */
export async function listDbNames(): Promise<string[]> {
  if (!vibeApiRef) {
    throw new Error("Firefly not initialized — registerFirefly() must be called before listDbNames()");
  }
  const rRes = await vibeApiRef.listDbNames();
  if (rRes.isErr()) {
    throw new Error(`Failed to list db names: ${rRes.Err()}`);
  }
  return rRes.Ok().dbNames;
}

/**
 * Standalone factory for non-React contexts (Node.js, Wrangler, scripts).
 * Mirrors the fireproof("name") API from use-fireproof.
 */
export function fireproof(name: string): FireflyDatabase {
  return getOrCreateDb(name);
}

/**
 * Drop-in replacement for useFireproof that uses FireflyDatabase.
 * Apps call: const { database, useLiveQuery, useDocument } = useFireproof("mydb")
 */
export function useFireproof(
  name = "useFireproof",
  config: {
    acl?: DbAcl;
    access?: AccessFunction;
    optimistic?: boolean;
    anonymousLocal?: boolean;
    migrate?: MigrateFn;
    [key: string]: unknown;
  } = {}
) {
  const { mountParams } = useVibeContext();
  const viewerEnv = mountParams.viewerEnv;
  const userHandle = viewerEnv?.viewer?.userHandle;
  const signedIn = !!userHandle;

  // Optimistic writes are on by default (#2985); apps opt out per-db with
  // useFireproof(name, { optimistic: false }).
  const optimistic = config.optimistic ?? true;
  const cloudDb = useMemo(() => {
    const db = getOrCreateDb(name, config.acl);
    db.setOptimistic(optimistic);
    return db;
  }, [name, optimistic]);

  // Anonymous-local mode (#2988): while logged out, route writes/queries to a
  // localStorage store with the identical Fireproof surface, then migrate into
  // the cloud on first sign-in.
  const anonymousLocal = config.anonymousLocal ?? false;
  const migrate = config.migrate;
  const localDb = useMemo(() => (anonymousLocal ? getOrCreateLocalDb(name) : undefined), [name, anonymousLocal]);

  // Use the local store ONLY for a brand-new anonymous visitor. A returning-but-
  // signed-out visitor (this device has signed in before) falls through to the
  // cloud db so they're steered to sign in rather than silently starting a
  // throwaway second local session that would never reconcile with their account.
  // This guard is automatic and intentionally never surfaced to app code.
  const useLocal = anonymousLocal && !signedIn && !!localDb && !hasAuthedBefore(name);
  const database: FireflyQueryDatabase = useLocal && localDb ? localDb : cloudDb;

  // Keep the latest migrate callback in a ref so an inline app-supplied function
  // (new identity every render) doesn't re-trigger the migration effect below.
  const migrateRef = useRef(migrate);
  migrateRef.current = migrate;

  // On first sign-in: mark the device as authed, then migrate local docs into the
  // cloud and clear local storage. migrateLocalToCloud only clears on full
  // success, so a failed migration keeps local data recoverable — and we retry
  // with bounded backoff in-session, since signed-in reads are cloud-backed and a
  // transient network/access failure must not strand the local docs (making them
  // look "gone") until a reload. Only mark "done" on success or after exhausting
  // attempts; a later remount retries from scratch (#2988).
  const migrationRef = useRef<"idle" | "running" | "done">("idle");
  useEffect(() => {
    if (!anonymousLocal || !signedIn || !userHandle || !localDb) return;
    markAuthedBefore(name);
    if (migrationRef.current !== "idle") return;
    migrationRef.current = "running";
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts && !cancelled; attempt++) {
        try {
          await migrateLocalToCloud(localDb, cloudDb, userHandle, migrateRef.current);
          migrationRef.current = "done";
          return;
        } catch (e: unknown) {
          if (cancelled) return;
          if (attempt === maxAttempts) {
            // Give up for this session — local storage is untouched (no data
            // loss), so a later remount retries from a fresh "idle" ref.
            migrationRef.current = "done";
            console.error(`anonymousLocal migration failed for db "${name}" after ${attempt} attempts:`, e);
            return;
          }
          // Exponential backoff: 0.5s, 1s, 2s, 4s.
          await new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 500 * 2 ** (attempt - 1));
          });
        }
      }
      // Interrupted before completing (unmount / dep change) — allow a retry.
      if (cancelled && migrationRef.current === "running") migrationRef.current = "idle";
    };
    void run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (migrationRef.current === "running") migrationRef.current = "idle";
    };
  }, [anonymousLocal, signedIn, userHandle, localDb, cloudDb, name]);

  const useDocument = useMemo(() => createUseDocument(database), [database]);
  const useLiveQuery = useMemo(() => createUseLiveQuery(database), [database]);
  const useAllDocs = useMemo(() => createUseAllDocs(database), [database]);
  const useChanges = useMemo(() => createUseChanges(database), [database]);
  const attach = () => Promise.resolve();

  const grantsForDb = viewerEnv?.grants?.[name];
  const access: DatabaseAccess = useMemo(() => {
    if (!grantsForDb) return EMPTY_ACCESS;
    const roles: ReadonlySet<string> = new Set(grantsForDb.roles);
    const channels: ReadonlySet<string> = new Set(grantsForDb.channels);
    return {
      roles,
      channels,
      hasRole: (role: string) => roles.has(role),
      hasChannel: (channel: string) => channels.has(channel),
    };
  }, [grantsForDb]);

  // Re-subscribe when this db's grants change so the server refreshes the
  // channel snapshot (new per-doc channels become live). Compare against the
  // previously-committed signature rather than skip-first so a StrictMode
  // double-invoke on mount can't trigger a spurious re-subscribe — the
  // FireflyDatabase constructor already subscribed once on mount. Multiple
  // useFireproof(name) callers each run this; subscribeDocs dedupe makes the
  // redundant re-subscribes harmless.
  const grantsSig = grantsSignature(mountParams.viewerEnv, name);
  const lastGrantsSig = useRef(grantsSig);
  useEffect(() => {
    if (lastGrantsSig.current === grantsSig) return;
    lastGrantsSig.current = grantsSig;
    database.resubscribe();
  }, [database, grantsSig]);

  return { database, useLiveQuery, useDocument, useAllDocs, useChanges, attach, access };
}

// ── Inline React hooks (no Fireproof dependency) ────────────────────

function createUseDocument(database: FireflyQueryDatabase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function useDocument(initialDocOrFn?: any) {
    // Re-fetches when viewer identity resolves asynchronously (#2285).
    const { mountParams } = useVibeContext();
    const viewerEnv = mountParams.viewerEnv;
    const viewerKey = `${viewerEnv?.viewer?.userHandle ?? ""}:${viewerEnv?.access ?? ""}:${grantsSignature(viewerEnv, database.name)}`;
    const updateHappenedRef = useRef(false);
    let initialDoc: Record<string, unknown>;
    if (typeof initialDocOrFn === "function") {
      initialDoc = initialDocOrFn();
    } else {
      initialDoc = initialDocOrFn ?? {};
    }
    const originalInitialDoc = useMemo(() => structuredClone({ ...initialDoc }), []);
    const [doc, setDoc] = useState(initialDoc);
    // #1756: one ephemeral-broadcast coalescer per hook instance, bound to the
    // database. Collapses a merge() burst per _id to one broadcast per frame.
    // Canceled on unmount so a pending flush never fires into a torn-down hook.
    // Optional-call: LocalDatabase (anonymous local mode, #2988) has no peers to
    // broadcast to, so it simply doesn't implement broadcastEphemeral.
    const coalescer = useMemo(() => createEphemeralCoalescer((id, snapshot) => database.broadcastEphemeral?.(id, snapshot)), []);
    useEffect(() => () => coalescer.cancel(), [coalescer]);
    const refresh = useCallback(async () => {
      if (doc._id) {
        try {
          const gotDoc = await database.get(doc._id as string);
          setDoc(gotDoc);
        } catch {
          setDoc(initialDoc);
        }
      } else {
        setDoc(initialDoc);
      }
    }, [doc._id]);
    const save = useCallback(
      async (existingDoc?: Record<string, unknown>) => {
        updateHappenedRef.current = false;
        const toSave = existingDoc ?? doc;
        const res = await database.put(toSave);
        if (!updateHappenedRef.current && !doc._id && !existingDoc) {
          setDoc((d) => ({ ...d, _id: res.id }));
        }
        return res;
      },
      [doc]
    );
    const remove = useCallback(
      async (existingDoc?: Record<string, unknown>) => {
        const id = (existingDoc?._id ?? doc._id) as string | undefined;
        if (!id) throw new Error("Document must have an _id to be removed");
        const gotDoc = await database.get(id).catch(() => undefined);
        if (!gotDoc) throw new Error(`Document not found: ${id}`);
        const res = await database.del(id);
        setDoc(initialDoc);
        return res;
      },
      [doc, initialDoc]
    );
    const merge = useCallback(
      (newDoc: Record<string, unknown>) => {
        updateHappenedRef.current = true;
        setDoc((prev) => {
          const next = { ...prev, ...newDoc };
          // #1756: broadcast the MERGED snapshot (not the bare partial) so
          // receiver-synthesized rows carry type/indexed fields. Only when the
          // doc has an _id — a page-local draft with no _id stays private.
          if (next._id) coalescer.push(next._id as string, next);
          return next;
        });
      },
      [coalescer]
    );
    const replace = useCallback((newDoc: Record<string, unknown>) => {
      updateHappenedRef.current = true;
      setDoc(newDoc);
    }, []);
    const reset = useCallback(() => {
      updateHappenedRef.current = true;
      setDoc({ ...originalInitialDoc });
    }, [originalInitialDoc]);
    const _updateDoc = useCallback(
      (newDoc?: Record<string, unknown>, opts = { replace: false, reset: false }) => {
        if (!newDoc) {
          return opts.reset ? reset() : refresh();
        }
        return opts.replace ? replace(newDoc) : merge(newDoc);
      },
      [refresh, reset, replace, merge]
    );
    useEffect(() => {
      if (!doc._id) return;
      return database.subscribe((changes) => {
        if (updateHappenedRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (changes.find((c: any) => c._id === doc._id)) {
          void refresh();
        }
      }, true);
    }, [doc._id, refresh]);
    useEffect(() => {
      void refresh();
    }, [refresh, viewerKey]);
    const submit = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (e?: any) => {
        if (e?.preventDefault) e.preventDefault();
        await save();
        reset();
      },
      [save, reset]
    );
    return { doc: { ...doc }, merge, replace, reset, refresh, save, remove, submit };
  };
}

function createUseLiveQuery(database: FireflyQueryDatabase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function useLiveQuery(mapFn: any, query: any = {}, initialRows: any[] = []) {
    // Re-fetches when viewer identity resolves asynchronously (#2285).
    const { mountParams } = useVibeContext();
    const viewerEnv = mountParams.viewerEnv;
    const viewerKey = `${viewerEnv?.viewer?.userHandle ?? ""}:${viewerEnv?.access ?? ""}:${grantsSignature(viewerEnv, database.name)}`;
    const [result, setResult] = useState({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      docs: initialRows.map((r: any) => r.doc).filter((r: any) => !!r),
      rows: initialRows,
    });
    const queryString = useMemo(() => JSON.stringify(query), [query]);
    const mapFnString = useMemo(() => mapFn.toString(), [mapFn]);
    // Cache the last raw (pre-overlay) server docs so an optimistic write can
    // re-materialize instantly against the overlay — no round-trip (#2985).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serverDocsRef = useRef<any[]>([]);
    const queryOpts = useMemo(() => ({ ...query, includeDocs: true }), [queryString]);
    const refreshRows = useCallback(async () => {
      const { result: res, serverDocs } = await database.queryLive(mapFn, queryOpts);
      serverDocsRef.current = serverDocs;
      setResult(res);
    }, [database, mapFnString, queryString]);
    useEffect(() => {
      refreshRows();
      // On an optimistic local write, re-materialize synchronously from the
      // cached server docs + overlay for instant UI, then still kick the async
      // refresh to reconcile with the server. Remote/confirmed changes just
      // refresh (they carry no overlay entry to apply locally).
      const unsubscribe = database.subscribe((_changes, meta) => {
        // Ephemeral presence updates (#1756) change only the client-side
        // overlay — server state is untouched, so re-materialize from the
        // cached server docs and SKIP the refetch. Without this, every
        // received cursor frame would trigger a queryDocs round-trip from
        // every subscriber (refetch amplification on hot vibes).
        if (meta?.ephemeral) {
          setResult(database.materializeLive(serverDocsRef.current, mapFn, queryOpts));
          return;
        }
        if (meta?.optimistic) {
          setResult(database.materializeLive(serverDocsRef.current, mapFn, queryOpts));
        }
        void refreshRows();
      });
      return () => {
        unsubscribe();
      };
    }, [database, refreshRows, viewerKey]);
    return result;
  };
}

function createUseAllDocs(database: FireflyQueryDatabase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function useAllDocs(query: any = {}) {
    // Re-fetches when viewer identity resolves asynchronously (#2285).
    const { mountParams } = useVibeContext();
    const viewerEnv = mountParams.viewerEnv;
    const viewerKey = `${viewerEnv?.viewer?.userHandle ?? ""}:${viewerEnv?.access ?? ""}:${grantsSignature(viewerEnv, database.name)}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result, setResult] = useState<any>({ docs: [], rows: [] });
    const queryString = useMemo(() => JSON.stringify(query), [query]);
    const refreshRows = useCallback(async () => {
      const res = await database.allDocs(query);
      setResult({
        ...res,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        docs: res.rows.map((r: any) => r.value),
      });
    }, [database, queryString]);
    useEffect(() => {
      refreshRows();
      const unsubscribe = database.subscribe(refreshRows);
      return () => {
        unsubscribe();
      };
    }, [database, refreshRows, viewerKey]);
    return result;
  };
}

function createUseChanges(database: FireflyQueryDatabase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function useChanges(_since: any[] = [], opts: any = {}) {
    // Re-fetches when viewer identity resolves asynchronously (#2285).
    const { mountParams } = useVibeContext();
    const viewerEnv = mountParams.viewerEnv;
    const viewerKey = `${viewerEnv?.viewer?.userHandle ?? ""}:${viewerEnv?.access ?? ""}:${grantsSignature(viewerEnv, database.name)}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result, setResult] = useState<any>({ docs: [], rows: [] });
    const queryString = useMemo(() => JSON.stringify(opts), [opts]);
    const refreshRows = useCallback(async () => {
      const res = await database.changes();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setResult({ ...res, docs: res.rows.map((r: any) => r.value) });
    }, [queryString]);
    useEffect(() => {
      refreshRows();
      return database.subscribe(refreshRows);
    }, [refreshRows, viewerKey]);
    return result;
  };
}
