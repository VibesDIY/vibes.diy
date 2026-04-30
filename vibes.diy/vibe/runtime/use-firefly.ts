/**
 * Firefly — drop-in useFireproof replacement backed by the vibes-diy API.
 *
 * Inline React hooks (no Fireproof dependency). Apps get this via the
 * import map: "use-fireproof" → "@vibes.diy/vibe-runtime".
 */

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { FireflyDatabase } from "./firefly-database.js";
import type { VibeSandboxApi } from "./register-dependencies.js";

// Module-scoped state, set by registerFirefly()
let vibeApiRef: VibeSandboxApi | undefined;

// Cache FireflyDatabase instances by name so useMemo stability works
const dbCache = new Map<string, FireflyDatabase>();

function getOrCreateDb(name: string): FireflyDatabase {
  let db = dbCache.get(name);
  if (!db) {
    if (!vibeApiRef) {
      throw new Error("Firefly not initialized — registerFirefly() must be called before useFireproof()");
    }
    db = new FireflyDatabase(name, vibeApiRef);
    dbCache.set(name, db);
  }
  return db;
}

/**
 * Register the Firefly system. Called by registerDependencies().
 */
export async function registerFirefly(api: VibeSandboxApi): Promise<void> {
  vibeApiRef = api;

  // Subscribe to docs for cross-client sync (fire-and-forget)
  api.subscribeDocs().then((rRes) => {
    if (rRes.isErr()) {
      console.error("Failed to subscribe to docs:", rRes.Err());
    }
  });
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFireproof(name = "useFireproof", _config: any = {}) {
  const database = useMemo(() => getOrCreateDb(name), [name]);
  const useDocument = useMemo(() => createUseDocument(database), [database]);
  const useLiveQuery = useMemo(() => createUseLiveQuery(database), [database]);
  const useAllDocs = useMemo(() => createUseAllDocs(database), [database]);
  const useChanges = useMemo(() => createUseChanges(database), [database]);
  const attach = () => Promise.resolve();
  return { database, useLiveQuery, useDocument, useAllDocs, useChanges, attach };
}

// ── Inline React hooks (no Fireproof dependency) ────────────────────

function createUseDocument(database: FireflyDatabase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function useDocument(initialDocOrFn?: any) {
    const updateHappenedRef = useRef(false);
    let initialDoc: Record<string, unknown>;
    if (typeof initialDocOrFn === "function") {
      initialDoc = initialDocOrFn();
    } else {
      initialDoc = initialDocOrFn ?? {};
    }
    const originalInitialDoc = useMemo(() => structuredClone({ ...initialDoc }), []);
    const [doc, setDoc] = useState(initialDoc);
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
    const merge = useCallback((newDoc: Record<string, unknown>) => {
      updateHappenedRef.current = true;
      setDoc((prev) => ({ ...prev, ...newDoc }));
    }, []);
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
    }, [refresh]);
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

function createUseLiveQuery(database: FireflyDatabase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function useLiveQuery(mapFn: any, query: any = {}, initialRows: any[] = []) {
    const [result, setResult] = useState({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      docs: initialRows.map((r: any) => r.doc).filter((r: any) => !!r),
      rows: initialRows,
    });
    const queryString = useMemo(() => JSON.stringify(query), [query]);
    const mapFnString = useMemo(() => mapFn.toString(), [mapFn]);
    const refreshRows = useCallback(async () => {
      const res = await database.query(mapFn, { ...query, includeDocs: true });
      setResult(res);
    }, [database, mapFnString, queryString]);
    useEffect(() => {
      refreshRows();
      const unsubscribe = database.subscribe(refreshRows);
      return () => {
        unsubscribe();
      };
    }, [database, refreshRows]);
    return result;
  };
}

function createUseAllDocs(database: FireflyDatabase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function useAllDocs(query: any = {}) {
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
    }, [database, refreshRows]);
    return result;
  };
}

function createUseChanges(database: FireflyDatabase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function useChanges(_since: any[] = [], opts: any = {}) {
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
    }, [refreshRows]);
    return result;
  };
}
