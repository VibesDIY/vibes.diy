/**
 * LocalDatabase — a fully local, localStorage-backed store that presents the
 * same Fireproof-shaped surface as FireflyDatabase (#2988).
 *
 * While a visitor is logged out, useFireproof(name, { anonymousLocal: true })
 * routes writes/queries here instead of the cloud (the hosting layer rejects
 * anonymous cloud writes). The query engine is shared with FireflyDatabase via
 * materializeQuery, so the full index/query surface (string/function index,
 * key/keys/range/prefix/descending/limit) behaves identically in both modes —
 * app code never branches on auth. On first sign-in, migrateLocalToCloud copies
 * these docs into the real cloud database and clears local storage.
 */

import {
  materializeQuery,
  newOptimisticId,
  type DocTypes,
  type DocWithId,
  type DocResponse,
  type QueryResponse,
  type QueryOpts,
  type MapFnArg,
  type IndexRow,
  type ListenerFn,
  type ChangeMeta,
  type FireflyQueryDatabase,
} from "./firefly-database.js";

const LOCAL_PREFIX = "firefly-anon";

function dbStorageKey(name: string): string {
  return `${LOCAL_PREFIX}:db:${name}`;
}
function authedBeforeKey(name: string): string {
  return `${LOCAL_PREFIX}:authed:${name}`;
}

/** localStorage if usable (browser), else undefined (SSR/Node → in-memory only). */
function safeLocalStorage(): Storage | undefined {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    // Touch it — some environments expose the object but throw on access.
    if (s) {
      const k = `${LOCAL_PREFIX}:probe`;
      s.setItem(k, "1");
      s.removeItem(k);
      return s;
    }
  } catch {
    /* not available */
  }
  return undefined;
}

/**
 * Whether this device/origin has ever been signed in for this db. Persisted so a
 * returning-but-signed-out visitor is NOT handed a fresh anonymous session. This
 * is deliberately internal (never returned from useFireproof): the returning-user
 * guard must be automatic, not something app code can branch on or bypass (#2988).
 */
export function hasAuthedBefore(name: string, storage: Storage | undefined = safeLocalStorage()): boolean {
  try {
    return storage?.getItem(authedBeforeKey(name)) === "1";
  } catch {
    return false;
  }
}

export function markAuthedBefore(name: string, storage: Storage | undefined = safeLocalStorage()): void {
  try {
    storage?.setItem(authedBeforeKey(name), "1");
  } catch {
    /* best effort */
  }
}

export class LocalDatabase implements FireflyQueryDatabase {
  readonly name: string;
  private readonly docs = new Map<string, DocWithId>();
  private readonly listeners = new Set<ListenerFn>();
  private readonly storage?: Storage;

  constructor(name: string, storage: Storage | undefined = safeLocalStorage()) {
    this.name = name;
    this.storage = storage;
    this.load();
  }

  private load(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(dbStorageKey(this.name));
      if (!raw) return;
      const arr = JSON.parse(raw) as DocWithId[];
      if (Array.isArray(arr)) {
        for (const d of arr) if (d && typeof d._id === "string") this.docs.set(d._id, d);
      }
    } catch {
      // Corrupt payload — start empty rather than throw on mount.
    }
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(dbStorageKey(this.name), JSON.stringify([...this.docs.values()]));
    } catch {
      // Quota exceeded / storage full — best effort; in-memory copy stays correct.
    }
  }

  // ── lifecycle no-ops (parity with FireflyDatabase) ──────────────────
  async ready(): Promise<void> {
    return;
  }
  async close(): Promise<void> {
    return;
  }
  async destroy(): Promise<void> {
    return;
  }
  async compact(): Promise<void> {
    return;
  }
  resubscribe(): void {
    return;
  }
  /** Optimism is meaningless locally — writes are already synchronous. */
  setOptimistic(_enabled: boolean): void {
    return;
  }

  async get<T extends DocTypes>(id: string): Promise<DocWithId<T>> {
    const doc = this.docs.get(id);
    if (!doc) throw new Error(`Failed to get document: ${id} (not found)`);
    return { ...doc } as DocWithId<T>;
  }

  async put<T extends DocTypes>(doc: T & { _id?: string }): Promise<DocResponse> {
    const id = doc._id ?? newOptimisticId();
    const saved = { ...doc, _id: id } as DocWithId;
    this.docs.set(id, saved);
    this.persist();
    this.notify([saved]);
    return { id, ok: true };
  }

  async del(id: string): Promise<DocResponse> {
    this.docs.delete(id);
    this.persist();
    this.notify([{ _id: id, _deleted: true } as DocWithId]);
    return { id, ok: true };
  }

  async remove(id: string): Promise<DocResponse> {
    return this.del(id);
  }

  async bulk<T extends DocTypes>(docs: (T & { _id?: string })[]): Promise<{ ids: string[] }> {
    const ids: string[] = [];
    for (const doc of docs) ids.push((await this.put(doc)).id);
    return { ids };
  }

  private snapshotDocs<T extends DocTypes>(): DocWithId<T>[] {
    return [...this.docs.values()].map((d) => ({ ...d })) as DocWithId<T>[];
  }

  async query<T extends DocTypes>(mapFn: MapFnArg<T>, opts: QueryOpts = {}): Promise<QueryResponse<T>> {
    return materializeQuery(this.snapshotDocs<T>(), mapFn, opts);
  }

  async queryLive<T extends DocTypes>(
    mapFn: MapFnArg<T>,
    opts: QueryOpts = {}
  ): Promise<{ result: QueryResponse<T>; serverDocs: DocWithId<T>[] }> {
    const serverDocs = this.snapshotDocs<T>();
    return { result: materializeQuery(serverDocs, mapFn, opts), serverDocs };
  }

  materializeLive<T extends DocTypes>(serverDocs: DocWithId<T>[], mapFn: MapFnArg<T>, opts: QueryOpts = {}): QueryResponse<T> {
    return materializeQuery(serverDocs, mapFn, opts);
  }

  async allDocs<T extends DocTypes>(
    opts: { limit?: number; offset?: number; descending?: boolean } = {}
  ): Promise<{ rows: IndexRow<T>[]; docs: DocWithId<T>[] }> {
    let docs = this.snapshotDocs<T>();
    docs.sort((a, b) => (a._id < b._id ? -1 : a._id > b._id ? 1 : 0));
    if (opts.descending) docs.reverse();
    if (opts.offset) docs = docs.slice(opts.offset);
    if (opts.limit !== undefined) docs = docs.slice(0, opts.limit);
    const rows = docs.map((doc) => ({ key: doc._id, value: doc, doc }));
    return { rows, docs };
  }

  async changes<T extends DocTypes>(): Promise<{ rows: IndexRow<T>[]; docs: DocWithId<T>[] }> {
    return { rows: [], docs: [] };
  }

  subscribe<T extends DocTypes>(listener: ListenerFn<T>, _updates?: boolean): () => void {
    const fn = listener as ListenerFn;
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(docs: DocWithId[], meta?: ChangeMeta): void {
    for (const fn of this.listeners) {
      try {
        if (meta === undefined) fn(docs);
        else fn(docs, meta);
      } catch {
        // Don't let a failing listener break others
      }
    }
  }

  // ── migration support ───────────────────────────────────────────────
  /** All local docs (copies), for migration into the cloud on first sign-in. */
  snapshot<T extends DocTypes>(): DocWithId<T>[] {
    return this.snapshotDocs<T>();
  }

  get size(): number {
    return this.docs.size;
  }

  /** Drop all local docs and remove them from storage (post-migration). */
  clear(): void {
    this.docs.clear();
    if (this.storage) {
      try {
        this.storage.removeItem(dbStorageKey(this.name));
      } catch {
        /* best effort */
      }
    }
    this.notify([]);
  }
}

// Cache LocalDatabase instances by name so useMemo stability holds and every
// caller in a runtime shares one anonymous store per db name.
const localDbCache = new Map<string, LocalDatabase>();

export function getOrCreateLocalDb(name: string): LocalDatabase {
  let db = localDbCache.get(name);
  if (!db) {
    db = new LocalDatabase(name);
    localDbCache.set(name, db);
  }
  return db;
}

/** Migration callback: transform a local doc for its new owner; return falsy to drop it. */
export type MigrateFn = (doc: DocWithId, userHandle: string) => Record<string, unknown> | null | undefined | false;

/**
 * On first sign-in, copy each local doc (via an optional migrate transform) into
 * the cloud database, then clear local storage — but only after every write
 * succeeds, so a failed migration leaves the local data intact and recoverable
 * (#2988). Idempotent when migrate preserves `_id`: a re-run overwrites the same
 * cloud docs rather than duplicating them.
 */
export async function migrateLocalToCloud(
  localDb: LocalDatabase,
  cloudDb: FireflyQueryDatabase,
  userHandle: string,
  migrate?: MigrateFn
): Promise<{ migrated: number; dropped: number }> {
  const docs = localDb.snapshot();
  if (docs.length === 0) return { migrated: 0, dropped: 0 };

  let migrated = 0;
  let dropped = 0;
  for (const doc of docs) {
    const out = migrate ? migrate(doc, userHandle) : doc;
    if (!out) {
      dropped++;
      continue;
    }
    await cloudDb.put(out as Record<string, unknown> & { _id?: string });
    migrated++;
  }
  // Only clear once every write landed — a throw above aborts before this,
  // leaving local storage untouched so nothing is lost.
  localDb.clear();
  return { migrated, dropped };
}
