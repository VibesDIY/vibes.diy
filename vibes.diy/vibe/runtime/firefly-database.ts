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
// @ts-expect-error "charwise" has no types
import charwise from "charwise";

// Types matching the use-fireproof Database interface.
// Exported for use by consumers (img-vibes, db-explorer, etc.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DocTypes = Record<string, any>;
export type DocWithId<T extends DocTypes = DocTypes> = T & { _id: string };
export interface DocResponse {
  id: string;
  ok: boolean;
}
export type ListenerFn<T extends DocTypes = DocTypes> = (changes: DocWithId<T>[]) => void;

export interface IndexRow<T extends DocTypes = DocTypes> {
  key: string;
  value: DocWithId<T>;
  doc?: DocWithId<T>;
}

export interface QueryResponse<T extends DocTypes = DocTypes> {
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

    // Listen for remote doc-changed events (cross-client sync). Filter on
    // dbName so a sibling FireflyDatabase on the same connection (e.g. the
    // comments db on the same vibe) doesn't trigger spurious reloads here.
    this.vibeApi.onMsg((event) => {
      const { data } = event;
      if (
        isEvtDocChanged(data) &&
        data.userSlug === this.vibeApp.userSlug &&
        data.appSlug === this.vibeApp.appSlug &&
        data.dbName === this.name
      ) {
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
    const rRes = await this.vibeApi.getDoc(id, this.name);
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
    const rRes = await this.vibeApi.putDoc(doc, doc._id, this.name);
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
    const rRes = await this.vibeApi.deleteDoc(id, this.name);
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
    mapFn: string | ((doc: DocWithId<T>, emit?: (key: unknown, value?: unknown) => void) => unknown),
    opts: {
      includeDocs?: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      key?: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      keys?: any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      range?: [any, any];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prefix?: any;
      descending?: boolean;
      limit?: number;
    } = {}
  ): Promise<QueryResponse<T>> {
    const rRes = await this.vibeApi.queryDocs(this.name);
    if (rRes.isErr()) {
      throw new Error(`Failed to query documents: ${rRes.Err()}`);
    }
    const res = rRes.Ok();
    if (!isResQueryDocs(res)) {
      return { rows: [], docs: [] };
    }

    const allDocs = res.docs.map((d) => ({ ...d, _id: d._id }) as DocWithId<T>);

    // Build index entries — keys stored as charwise-encoded strings for correct sort
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let encodedRows: { encodedKey: string; decodedKey: any; value: DocWithId<T>; doc?: DocWithId<T> }[];

    if (typeof mapFn === "string") {
      // String field name — filter docs that have this field, key = field value
      encodedRows = allDocs
        .filter((doc) => doc[mapFn] !== undefined)
        .map((doc) => ({
          encodedKey: charwise.encode(doc[mapFn]) as string,
          decodedKey: doc[mapFn],
          value: doc,
          doc: opts.includeDocs ? doc : undefined,
        }));
    } else if (typeof mapFn === "function") {
      // MapFn — supports both emit() and return-value patterns (matches fireproof behavior)
      encodedRows = [];
      for (const doc of allDocs) {
        try {
          let emitCalled = false;
          const emit = (key: unknown) => {
            emitCalled = true;
            if (typeof key === "undefined") return;
            encodedRows.push({
              encodedKey: charwise.encode(key) as string,
              decodedKey: key,
              value: doc,
              doc: opts.includeDocs ? doc : undefined,
            });
          };
          // Fireproof calls mapFn(doc, emit) — supports three patterns:
          //   1. (doc, emit) => { emit(key) }     — explicit emit as arg
          //   2. function(doc) { this.emit(key) }  — emit via this
          //   3. (doc) => key                       — return value is the key
          const mapReturn = mapFn.call({ emit }, doc, emit);
          // If emit was never called and return value is defined, use return as key
          if (!emitCalled && typeof mapReturn !== "undefined") {
            encodedRows.push({
              encodedKey: charwise.encode(mapReturn) as string,
              decodedKey: mapReturn,
              value: doc,
              doc: opts.includeDocs ? doc : undefined,
            });
          }
        } catch {
          // Skip docs that error in mapFn
        }
      }
    } else {
      // No mapFn — return all docs keyed by _id
      encodedRows = allDocs.map((doc) => ({
        encodedKey: charwise.encode(doc._id) as string,
        decodedKey: doc._id,
        value: doc,
        doc: opts.includeDocs ? doc : undefined,
      }));
    }

    // Apply query filters using charwise-encoded comparisons
    if (opts.key !== undefined) {
      const encodedKey = charwise.encode(opts.key) as string;
      encodedRows = encodedRows.filter((r) => r.encodedKey === encodedKey);
    }
    if (opts.keys !== undefined) {
      const encodedKeys = new Set(opts.keys.map((k: unknown) => charwise.encode(k) as string));
      encodedRows = encodedRows.filter((r) => encodedKeys.has(r.encodedKey));
    }
    if (opts.range) {
      const encodedStart = charwise.encode(opts.range[0]) as string;
      const encodedEnd = charwise.encode(opts.range[1]) as string;
      encodedRows = encodedRows.filter((r) => r.encodedKey >= encodedStart && r.encodedKey <= encodedEnd);
    }
    if (opts.prefix !== undefined) {
      // For array prefixes, strip the trailing "!" so [2024,11] matches [2024,11,15]
      let encodedPrefix = charwise.encode(opts.prefix) as string;
      if (Array.isArray(opts.prefix) && encodedPrefix.endsWith("!")) {
        encodedPrefix = encodedPrefix.slice(0, -1);
      }
      encodedRows = encodedRows.filter((r) => r.encodedKey.startsWith(encodedPrefix));
    }

    // Sort by encoded key (charwise ensures correct type-aware ordering)
    encodedRows.sort((a, b) => (a.encodedKey < b.encodedKey ? -1 : a.encodedKey > b.encodedKey ? 1 : 0));
    if (opts.descending) {
      encodedRows.reverse();
    }

    // Limit
    if (opts.limit !== undefined) {
      encodedRows = encodedRows.slice(0, opts.limit);
    }

    // Decode keys back for output
    const rows: IndexRow<T>[] = encodedRows.map((r) => ({
      key: r.decodedKey,
      value: r.value,
      doc: r.doc,
    }));

    return {
      rows,
      docs: rows.map((r) => r.value),
    };
  }

  async allDocs<T extends DocTypes>(
    opts: { limit?: number; offset?: number; descending?: boolean } = {}
  ): Promise<{ rows: IndexRow<T>[]; docs: DocWithId<T>[] }> {
    const rRes = await this.vibeApi.queryDocs(this.name);
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
    } else {
      this.listeners.add(fn);
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
