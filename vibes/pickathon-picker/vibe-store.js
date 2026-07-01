// vibe-store — a Fireproof-compatible store that is fully local (localStorage)
// while the visitor is logged out, and delegates to real Fireproof once they
// sign in. On the logged-out → signed-in transition it migrates the local
// documents into Fireproof and clears local storage.
//
// The point is a single "mode" on the database object: app code calls the same
// `database.put/del`, `useLiveQuery`, and `useDocument` in both cases and never
// branches on auth. Kept as its own file so it can be lifted into the platform
// later; it only depends on use-fireproof + use-vibes.
//
// Supported query surface (what this app uses): string or function index,
// `{ key }` equality (scalar or array keys), `{ prefix }`, `{ range }`,
// `{ descending }`, `{ limit }`. Good enough to generalize, not a full engine.
import { useState, useEffect, useMemo, useRef } from "react";
import { useFireproof } from "use-fireproof";
import { useViewer } from "use-vibes";

const LS_PREFIX = "vibe-local:";
const AUTHED_PREFIX = "vibe-authed:"; // marks that this device has signed in before
const stores = new Map(); // dbName -> { docs: Map<_id,doc>, listeners: Set, version }

function markAuthed(dbName) {
  try {
    localStorage.setItem(AUTHED_PREFIX + dbName, "1");
  } catch (e) {}
}
function hasAuthed(dbName) {
  try {
    return localStorage.getItem(AUTHED_PREFIX + dbName) === "1";
  } catch (e) {
    return false;
  }
}

function loadDocs(dbName) {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_PREFIX + dbName) || "[]");
    const m = new Map();
    if (Array.isArray(raw)) for (const d of raw) if (d && d._id) m.set(d._id, d);
    return m;
  } catch (e) {
    return new Map();
  }
}
function persist(dbName, store) {
  try {
    localStorage.setItem(LS_PREFIX + dbName, JSON.stringify([...store.docs.values()]));
  } catch (e) {
    /* storage unavailable — data stays in memory for this session */
  }
}
function getStore(dbName) {
  let s = stores.get(dbName);
  if (!s) {
    s = { docs: loadDocs(dbName), listeners: new Set(), version: 0 };
    stores.set(dbName, s);
  }
  return s;
}
function notify(s) {
  s.version++;
  s.listeners.forEach((cb) => cb());
}

let idSeq = 0;
function localPut(dbName, doc) {
  const s = getStore(dbName);
  const _id = doc._id || `local-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;
  s.docs.set(_id, { ...doc, _id });
  persist(dbName, s);
  notify(s);
  return { id: _id, ok: true };
}
function localDel(dbName, id) {
  const s = getStore(dbName);
  s.docs.delete(id);
  persist(dbName, s);
  notify(s);
  return { ok: true };
}

// ---- tiny query engine over the local docs ------------------------------
function keyOf(index, doc) {
  return typeof index === "function" ? index(doc) : doc[index];
}
function cmp(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const c = cmp(a[i], b[i]);
      if (c) return c;
    }
    return a.length - b.length;
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
function prefixMatch(key, prefix) {
  if (!Array.isArray(key) || !Array.isArray(prefix)) return cmp(key, prefix) === 0;
  return prefix.every((p, i) => cmp(key[i], p) === 0);
}
function runQuery(docs, index, opts = {}) {
  let rows = [];
  for (const doc of docs) {
    const k = keyOf(index, doc);
    if (k === undefined || k === null) continue;
    rows.push({ k, doc });
  }
  if (opts.key !== undefined) rows = rows.filter((r) => cmp(r.k, opts.key) === 0);
  if (opts.prefix !== undefined) rows = rows.filter((r) => prefixMatch(r.k, opts.prefix));
  if (opts.range) rows = rows.filter((r) => cmp(r.k, opts.range[0]) >= 0 && cmp(r.k, opts.range[1]) <= 0);
  rows.sort((a, b) => cmp(a.k, b.k));
  if (opts.descending) rows.reverse();
  if (typeof opts.limit === "number") rows = rows.slice(0, opts.limit);
  return rows.map((r) => r.doc);
}

// Subscribe a component to a local store so live queries re-render on write.
function useLocalDocs(dbName) {
  const s = getStore(dbName);
  const [, bump] = useState(0);
  useEffect(() => {
    const cb = () => bump((x) => x + 1);
    s.listeners.add(cb);
    cb(); // catch writes that landed between render and effect
    return () => s.listeners.delete(cb);
  }, [s]);
  return [...s.docs.values()];
}

// ---- the hook: a drop-in `useFireproof` that switches on auth -------------
export function useVibeStore(dbName, options = {}) {
  const { viewer } = useViewer();
  const signedIn = Boolean(viewer?.userHandle);
  const isLocal = !signedIn;

  const fp = useFireproof(dbName);
  const localDocs = useLocalDocs(dbName);

  // First sign-in: copy local docs into Fireproof, then clear local. The
  // optional `migrate(doc, userHandle)` re-stamps ownership / re-keys _id
  // (return a falsy value to drop a doc). Runs once per mount.
  // Read once at mount: has this device ever completed a sign-in? Lets the app
  // steer a returning-but-logged-out visitor to sign in (their data is on their
  // account) instead of silently starting a throwaway second anonymous session.
  const hasAuthedBefore = useMemo(() => hasAuthed(dbName), [dbName]);

  const migratedRef = useRef(false);
  useEffect(() => {
    if (!signedIn || migratedRef.current) return;
    migratedRef.current = true;
    markAuthed(dbName);
    const s = getStore(dbName);
    if (s.docs.size === 0) return;
    const migrate = options.migrate || ((d) => d);
    (async () => {
      try {
        for (const doc of [...s.docs.values()]) {
          const out = migrate(doc, viewer.userHandle);
          if (out) await fp.database.put(out);
        }
        s.docs.clear();
        persist(dbName, s);
        notify(s);
      } catch (e) {
        console.error("vibe-store: migration failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, dbName]);

  const database = useMemo(() => {
    if (!isLocal) return fp.database;
    return {
      put: (doc) => Promise.resolve(localPut(dbName, doc)),
      del: (id) => Promise.resolve(localDel(dbName, id)),
      get: (id) => Promise.resolve(getStore(dbName).docs.get(id)),
    };
  }, [isLocal, fp.database, dbName]);

  // Both branches call their hooks unconditionally so the Rules of Hooks hold
  // regardless of mode; we just choose which result to hand back.
  const useLiveQuery = (index, opts) => {
    const cloud = fp.useLiveQuery(index, opts);
    return isLocal ? { docs: runQuery(localDocs, index, opts) } : cloud;
  };

  const useDocument = (initial) => {
    const cloud = fp.useDocument(initial);
    const [doc, setDoc] = useState(initial);
    if (!isLocal) return cloud;
    return {
      doc,
      merge: (patch) => setDoc((d) => ({ ...d, ...patch })),
      reset: () => setDoc(initial),
      save: (d) => Promise.resolve(localPut(dbName, d || doc)),
      submit: async (e) => {
        e?.preventDefault?.();
        localPut(dbName, doc);
        setDoc(initial);
      },
    };
  };

  return { database, useLiveQuery, useDocument, isLocal, hasAuthedBefore, access: fp.access };
}
