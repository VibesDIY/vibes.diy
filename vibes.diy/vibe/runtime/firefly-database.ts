/**
 * FireflyDatabase — a lightweight Database implementation that routes all storage
 * through the Evento postMessage bridge to the vibes-diy API's SQLite backend.
 *
 * No Fireproof dependency. Implements the subset of the Database interface that
 * the use-fireproof React hooks (useDocument, useLiveQuery, useAllDocs) actually call.
 */

import type { VibeSandboxApi, VibeApp } from "./register-dependencies.js";
// Response validators + event — re-exported from api-types via vibe-types
import { isResPutDoc, isResGetDoc, isResQueryDocs, isResDeleteDoc, isEvtDocChanged } from "@vibes.diy/vibe-types";

// Minimal types matching what the use-fireproof hooks expect
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DocTypes = Record<string, any>;
type DocWithId<T extends DocTypes = DocTypes> = T & { _id: string };
interface DocResponse {
  id: string;
  ok: boolean;
}
type ListenerFn<T extends DocTypes = DocTypes> = (changes: DocWithId<T>[]) => void;

interface IndexRow<T extends DocTypes = DocTypes> {
  key: string;
  value: DocWithId<T>;
  doc?: DocWithId<T>;
}

interface QueryResponse<T extends DocTypes = DocTypes> {
  rows: IndexRow<T>[];
  docs: DocWithId<T>[];
}

// Minimal logger matching what useDocument accesses
const fireflyLogger = {
  Error() {
    return {
      Msg(msg: string) {
        return {
          AsError() {
            return new Error(msg);
          },
        };
      },
      Str(_key: string, _val: string) {
        return {
          Msg(msg: string) {
            return {
              AsError() {
                return new Error(msg);
              },
            };
          },
        };
      },
    };
  },
};

export class FireflyDatabase {
  readonly name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly logger: any = fireflyLogger;

  private readonly vibeApi: VibeSandboxApi;
  private readonly vibeApp: VibeApp;
  private readonly listeners = new Set<ListenerFn>();
  private readonly updateListeners = new Set<ListenerFn>();

  constructor(name: string, vibeApi: VibeSandboxApi) {
    this.name = name;
    this.vibeApi = vibeApi;
    this.vibeApp = vibeApi.svc.vibeApp;

    // Listen for remote doc-changed events (cross-client sync)
    this.vibeApi.onMsg((event) => {
      const { data } = event;
      if (isEvtDocChanged(data) && data.appSlug === this.vibeApp.appSlug) {
        console.log(
          "[Firefly] evt-doc-changed received, notifying",
          this.listeners.size,
          "listeners +",
          this.updateListeners.size,
          "update listeners"
        );
        this.notifyListeners([]);
      }
    });
  }

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

  async get<T extends DocTypes>(id: string): Promise<DocWithId<T>> {
    console.log("[Firefly] get", id);
    const rRes = await this.vibeApi.getDoc(id);
    if (rRes.isErr()) {
      throw new Error(`Failed to get document: ${rRes.Err()}`);
    }
    const res = rRes.Ok();
    if (isResGetDoc(res)) {
      return { ...res.doc, _id: res.id } as DocWithId<T>;
    }
    throw new Error(`Failed to get document: ${JSON.stringify(res)}`);
  }

  async put<T extends DocTypes>(doc: T & { _id?: string }): Promise<DocResponse> {
    console.log("[Firefly] put", doc._id, doc);
    const rRes = await this.vibeApi.putDoc(doc, doc._id);
    if (rRes.isErr()) {
      throw new Error(`Failed to put document: ${rRes.Err()}`);
    }
    const res = rRes.Ok();
    if (isResPutDoc(res)) {
      const savedDoc = { ...doc, _id: res.id } as DocWithId<T>;
      this.notifyListeners([savedDoc]);
      return { id: res.id, ok: true };
    }
    throw new Error(`Failed to put document: ${JSON.stringify(res)}`);
  }

  async del(id: string): Promise<DocResponse> {
    const rRes = await this.vibeApi.deleteDoc(id);
    if (rRes.isErr()) {
      throw new Error(`Failed to delete document: ${rRes.Err()}`);
    }
    const res = rRes.Ok();
    if (isResDeleteDoc(res)) {
      this.notifyListeners([{ _id: res.id, _deleted: true } as DocWithId]);
      return { id: res.id, ok: true };
    }
    throw new Error(`Failed to delete document: ${JSON.stringify(res)}`);
  }

  async remove(id: string): Promise<DocResponse> {
    return this.del(id);
  }

  async bulk<T extends DocTypes>(docs: (T & { _id?: string })[]): Promise<{ ids: string[] }> {
    const ids: string[] = [];
    for (const doc of docs) {
      const res = await this.put(doc);
      ids.push(res.id);
    }
    return { ids };
  }

  async query<T extends DocTypes>(
    mapFn: string | ((doc: DocWithId<T>) => void),
    opts: {
      includeDocs?: boolean;
      key?: string;
      keys?: string[];
      range?: [string, string];
      prefix?: string;
      descending?: boolean;
      limit?: number;
    } = {}
  ): Promise<QueryResponse<T>> {
    // Fetch all docs from the API
    console.log("[Firefly] query called, fetching docs...");
    const rRes = await this.vibeApi.queryDocs();
    if (rRes.isErr()) {
      console.log("[Firefly] query error:", rRes.Err());
      throw new Error(`Failed to query documents: ${rRes.Err()}`);
    }
    const res = rRes.Ok();
    if (!isResQueryDocs(res)) {
      console.log("[Firefly] query response not matched, returning empty. res:", JSON.stringify(res).substring(0, 200));
      return { rows: [], docs: [] };
    }

    const allDocs = res.docs.map((d) => ({ ...d, _id: d._id }) as DocWithId<T>);
    console.log("[Firefly] query returned", allDocs.length, "docs");

    // Build index entries based on mapFn
    let rows: IndexRow<T>[];

    if (typeof mapFn === "string") {
      // String field name — filter docs that have this field, key = field value
      rows = allDocs
        .filter((doc) => doc[mapFn] !== undefined)
        .map((doc) => ({
          key: String(doc[mapFn]),
          value: doc,
          doc: opts.includeDocs ? doc : undefined,
        }));
    } else if (typeof mapFn === "function") {
      // MapFn — collect emitted entries
      rows = [];
      for (const doc of allDocs) {
        try {
          const emitted: { key: string; value: DocWithId<T> }[] = [];
          const emit = (key: string) => {
            emitted.push({ key: String(key), value: doc });
          };
          mapFn.call({ emit }, doc);
          // If mapFn didn't call emit, try calling it as (doc, emit)
          if (emitted.length === 0) {
            (mapFn as (doc: DocWithId<T>, emit: (key: string) => void) => void)(doc, emit);
          }
          for (const entry of emitted) {
            rows.push({
              key: entry.key,
              value: entry.value,
              doc: opts.includeDocs ? entry.value : undefined,
            });
          }
        } catch {
          // Skip docs that error in mapFn
        }
      }
    } else {
      // No mapFn — return all docs
      rows = allDocs.map((doc) => ({
        key: doc._id,
        value: doc,
        doc: opts.includeDocs ? doc : undefined,
      }));
    }

    // Apply query filters
    if (opts.key !== undefined) {
      rows = rows.filter((r) => r.key === opts.key);
    }
    if (opts.keys !== undefined) {
      const keySet = new Set(opts.keys);
      rows = rows.filter((r) => keySet.has(r.key));
    }
    if (opts.range) {
      const [start, end] = opts.range;
      rows = rows.filter((r) => r.key >= start && r.key <= end);
    }
    if (opts.prefix) {
      const prefix = opts.prefix;
      rows = rows.filter((r) => r.key.startsWith(prefix));
    }

    // Sort
    rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    if (opts.descending) {
      rows.reverse();
    }

    // Limit
    if (opts.limit !== undefined) {
      rows = rows.slice(0, opts.limit);
    }

    return {
      rows,
      docs: rows.map((r) => r.value),
    };
  }

  async allDocs<T extends DocTypes>(
    opts: { limit?: number; offset?: number; descending?: boolean } = {}
  ): Promise<{ rows: IndexRow<T>[]; docs: DocWithId<T>[] }> {
    const rRes = await this.vibeApi.queryDocs();
    if (rRes.isErr()) {
      throw new Error(`Failed to query documents: ${rRes.Err()}`);
    }
    const res = rRes.Ok();
    if (!isResQueryDocs(res)) {
      return { rows: [], docs: [] };
    }

    let docs = res.docs.map((d) => ({ ...d, _id: d._id }) as DocWithId<T>);

    // Sort by _id
    docs.sort((a, b) => (a._id < b._id ? -1 : a._id > b._id ? 1 : 0));
    if (opts.descending) {
      docs.reverse();
    }
    if (opts.offset) {
      docs = docs.slice(opts.offset);
    }
    if (opts.limit !== undefined) {
      docs = docs.slice(0, opts.limit);
    }

    const rows = docs.map((doc) => ({
      key: doc._id,
      value: doc,
      doc,
    }));

    return { rows, docs };
  }

  async changes<T extends DocTypes>(): Promise<{ rows: IndexRow<T>[]; docs: DocWithId<T>[] }> {
    // changes() not meaningfully supported — return empty
    return { rows: [], docs: [] };
  }

  subscribe<T extends DocTypes>(listener: ListenerFn<T>, updates?: boolean): () => void {
    const fn = listener as ListenerFn;
    if (updates) {
      this.updateListeners.add(fn);
      console.log("[Firefly] subscribe (updates=true), total update listeners:", this.updateListeners.size);
    } else {
      this.listeners.add(fn);
      console.log("[Firefly] subscribe, total listeners:", this.listeners.size);
    }
    return () => {
      this.listeners.delete(fn);
      this.updateListeners.delete(fn);
    };
  }

  // Notify subscribers after mutations
  private notifyListeners(docs: DocWithId[]): void {
    for (const fn of this.listeners) {
      try {
        fn(docs);
      } catch {
        // Don't let a failing listener break others
      }
    }
    for (const fn of this.updateListeners) {
      try {
        fn(docs);
      } catch {
        // Don't let a failing listener break others
      }
    }
  }
}
