/**
 * Test double for VibesDiyApi. In-memory doc store, no WebSocket, no
 * Clerk dependency. Implements the subset FireflyApiAdapter actually
 * calls (ensureUserSettings, putDoc/getDoc/queryDocs/deleteDoc/
 * subscribeDocs, onDocChanged).
 */
import { Result } from "@adviser/cement";

let idCounter = 0;
let connectionCounter = 0;

export interface FakeVibesDiyApi {
  ensureUserSettings: (req: unknown) => Promise<Result<unknown>>;
  putDoc: (req: {
    appSlug: string;
    userSlug: string;
    dbName: string;
    doc: Record<string, unknown>;
    docId?: string;
  }) => Promise<Result<unknown>>;
  getDoc: (req: { appSlug: string; userSlug: string; dbName: string; docId: string }) => Promise<Result<unknown>>;
  queryDocs: (req: { appSlug: string; userSlug: string; dbName: string }) => Promise<Result<unknown>>;
  deleteDoc: (req: { appSlug: string; userSlug: string; dbName: string; docId: string }) => Promise<Result<unknown>>;
  subscribeDocs: (req: { appSlug: string; userSlug: string; dbName: string }) => Promise<Result<unknown>>;
  onDocChanged: (fn: (userSlug: string, appSlug: string, dbName: string, docId: string) => void) => () => void;
  /** how many times `new VibesDiyApi(...)` would have been called — used by multi-db test */
  readonly _connectionId: number;
  /** raw access to the doc store keyed by dbName */
  readonly _docs: Map<string, Map<string, Record<string, unknown>>>;
  /** simulate a server-push doc-changed event */
  _simulateDocChanged: (userSlug: string, appSlug: string, dbName: string, docId: string) => void;
}

export function createFakeVibesDiyApi(opts: { defaultUserSlug?: string } = {}): FakeVibesDiyApi {
  const docsByDb = new Map<string, Map<string, Record<string, unknown>>>();
  const docChangedListeners: ((u: string, a: string, db: string, doc: string) => void)[] = [];
  const connectionId = ++connectionCounter;

  function dbStore(dbName: string): Map<string, Record<string, unknown>> {
    let store = docsByDb.get(dbName);
    if (store === undefined) {
      store = new Map();
      docsByDb.set(dbName, store);
    }
    return store;
  }

  return {
    _connectionId: connectionId,
    _docs: docsByDb,

    ensureUserSettings: async () =>
      Result.Ok({
        type: "vibes.diy.res-ensure-user-settings",
        userId: `user-${connectionId}`,
        settings: opts.defaultUserSlug ? [{ type: "defaultUserSlug", userSlug: opts.defaultUserSlug }] : [],
        updated: "now",
        created: "now",
      }),

    putDoc: async (req) => {
      const id = req.docId ?? `${Date.now().toString(16)}-${(++idCounter).toString(16).padStart(8, "0")}`;
      dbStore(req.dbName).set(id, { ...req.doc, _id: id });
      return Result.Ok({ type: "vibes.diy.res-put-doc", status: "ok", id });
    },

    getDoc: async (req) => {
      const doc = dbStore(req.dbName).get(req.docId);
      if (doc === undefined) return Result.Err(`Document not found: ${req.docId}`);
      return Result.Ok({
        type: "vibes.diy.res-get-doc",
        status: "ok",
        id: req.docId,
        doc: { ...doc },
      });
    },

    queryDocs: async (req) => {
      const docs = [...dbStore(req.dbName).values()].map((d) => ({ ...d, _id: d._id as string }));
      return Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs });
    },

    deleteDoc: async (req) => {
      dbStore(req.dbName).delete(req.docId);
      return Result.Ok({ type: "vibes.diy.res-delete-doc", status: "ok", id: req.docId });
    },

    subscribeDocs: async () => Result.Ok({ type: "vibes.diy.res-subscribe-docs", status: "ok" }),

    onDocChanged: (fn) => {
      docChangedListeners.push(fn);
      return () => {
        const i = docChangedListeners.indexOf(fn);
        if (i >= 0) docChangedListeners.splice(i, 1);
      };
    },

    _simulateDocChanged: (userSlug, appSlug, dbName, docId) => {
      for (const fn of docChangedListeners) fn(userSlug, appSlug, dbName, docId);
    },
  };
}
