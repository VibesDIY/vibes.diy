/**
 * FireflyDatabase — a lightweight Database implementation that routes all storage
 * through the Evento postMessage bridge to the vibes-diy API's SQLite backend.
 *
 * No Fireproof dependency. Implements the subset of the Database interface that
 * the use-fireproof React hooks (useDocument, useLiveQuery, useAllDocs) actually call.
 */

import type { VibeApp } from "./register-dependencies.js";
import type { Result } from "@adviser/cement";
// Response validators + event — re-exported from api-types via vibe-types
import {
  isResPutDoc,
  isResGetDoc,
  isResQueryDocs,
  isResDeleteDoc,
  isEvtDocChanged,
  isEvtDocEphemeral,
  isEvtDocEphemeralDrop,
  type EvtDocEphemeral,
  type ResPutDoc,
  type ResGetDoc,
  type ResGetDocNotFound,
  type ResQueryDocs,
  type ResDeleteDoc,
  type ResSubscribeDocs,
  type ResSetDbAcl,
  type DbAcl,
  type QueryFilter,
} from "@vibes.diy/vibe-types";
import { decorateFiles } from "./firefly-files-read.js";
import { uploadFiles, type AssetUploader } from "./firefly-files-write.js";

/**
 * Structural subset of VibeSandboxApi that FireflyDatabase calls.
 * Implementations: VibeSandboxApi (postMessage, in-iframe) and
 * FireflyApiAdapter (WebSocket, Node/Wrangler). Both satisfy this
 * interface structurally — FireflyDatabase has no knowledge of which
 * transport is in use.
 */
export interface FireflyTransport {
  readonly svc: { readonly vibeApp: VibeApp };
  putDoc(doc: Record<string, unknown>, docId?: string, dbName?: string): Promise<Result<ResPutDoc>>;
  getDoc(docId: string, dbName?: string): Promise<Result<ResGetDoc | ResGetDocNotFound>>;
  queryDocs(dbName?: string, filter?: QueryFilter): Promise<Result<ResQueryDocs>>;
  deleteDoc(docId: string, dbName?: string): Promise<Result<ResDeleteDoc>>;
  subscribeDocs(dbName?: string): Promise<Result<ResSubscribeDocs>>;
  // Ephemeral presence broadcast (#1756): fire-and-forget, no return.
  broadcastEphemeral(docId: string, doc: Record<string, unknown>, dbName?: string): void;
  setDbAcl(dbName: string, acl: DbAcl): Promise<Result<ResSetDbAcl>>;
  onMsg(fn: (event: { data: unknown }) => void): void;
}
// @ts-expect-error "charwise" has no types
import charwise from "charwise";

// charwise encodes primitives and arrays but throws "can only encode arrays"
// on plain objects. Fall back to a stable JSON form so object-valued keys/fields
// still sort and filter deterministically client-side instead of crashing (#2425).
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const obj = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}
function encodeKey(v: unknown): string {
  try {
    return charwise.encode(v) as string;
  } catch {
    // Prefix with a high code point so object keys never collide with charwise output.
    return "￿obj:" + stableStringify(v);
  }
}

function randomHex(bytes: number): string {
  const g = (globalThis as { crypto?: Crypto }).crypto;
  if (g?.getRandomValues) {
    const arr = new Uint8Array(bytes);
    g.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  let s = "";
  for (let i = 0; i < bytes; i++)
    s += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");
  return s;
}

/**
 * Client-minted document id for an optimistic new doc (#2985). Only used on the
 * optimistic path for a brand-new doc (no `_id`); with optimism off the server
 * still mints the id.
 *
 * Matches the server's `timeOrderedNextId` 8-4-4-4-12 UUIDv7 layout
 * (identity/runtime/superthis.ts) EXACTLY — same 48-bit ms-timestamp prefix and
 * the same delimiter placement (first `-` after 8 timestamp-hex chars). This
 * matters for ordering: with a different layout, `-` (0x2d) sorts before hex
 * digits, so a server-minted id could sort *before* a later client-minted id in
 * `allDocs()` whenever the high 8 timestamp chars match (a ~65s window). Keeping
 * the layout identical makes `_id` lexical order monotonic across both id
 * families. The 80-bit random tail avoids cross-client collisions. `now` is
 * injectable for tests.
 */
export function newOptimisticId(now: number = Date.now()): string {
  const t = (0x1000000000000 + now).toString(16).replace(/^1/, "");
  const hex = randomHex(10);
  return `${t.slice(0, 8)}-${t.slice(8)}-7${hex.slice(0, 3)}-${hex.slice(3, 7)}-${hex.slice(7, 19)}`;
}

// Types matching the use-fireproof Database interface.
// Exported for use by consumers (img-vibes, db-explorer, etc.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DocTypes = Record<string, any>;
export type DocWithId<T extends DocTypes = DocTypes> = T & { _id: string };
export interface DocResponse {
  id: string;
  ok: boolean;
}
export interface ChangeMeta {
  /** True when the change is a local optimistic write not yet confirmed by the server. */
  readonly optimistic?: boolean;
}
export type ListenerFn<T extends DocTypes = DocTypes> = (changes: DocWithId<T>[], meta?: ChangeMeta) => void;

/**
 * A pending optimistic write, layered over the server's materialized view until
 * the write round-trips. `put` carries the optimistic doc; `del` is a tombstone.
 * `token` identifies the write that owns this entry so an earlier overlapping
 * write for the same _id doesn't clobber a newer one when it resolves (#2985).
 */
type OverlayEntry<T extends DocTypes = DocTypes> = ({ kind: "put"; doc: DocWithId<T> } | { kind: "del" }) & { token: number };

export interface IndexRow<T extends DocTypes = DocTypes> {
  key: string;
  value: DocWithId<T>;
  doc?: DocWithId<T>;
}

export interface QueryResponse<T extends DocTypes = DocTypes> {
  rows: IndexRow<T>[];
  docs: DocWithId<T>[];
}

export interface QueryOpts {
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
}

export type MapFnArg<T extends DocTypes = DocTypes> =
  | string
  | ((doc: DocWithId<T>, emit?: (key: unknown, value?: unknown) => void) => unknown);

/**
 * The Fireproof-shaped read/write surface the React hooks (useDocument,
 * useLiveQuery, useAllDocs, useChanges) drive. Both FireflyDatabase (cloud) and
 * LocalDatabase (anonymous localStorage, #2988) satisfy it, so the hooks work
 * against either without branching on auth.
 */
export interface FireflyQueryDatabase {
  readonly name: string;
  get<T extends DocTypes>(id: string): Promise<DocWithId<T>>;
  put<T extends DocTypes>(doc: T & { _id?: string }): Promise<DocResponse>;
  del(id: string): Promise<DocResponse>;
  remove(id: string): Promise<DocResponse>;
  query<T extends DocTypes>(mapFn: MapFnArg<T>, opts?: QueryOpts): Promise<QueryResponse<T>>;
  queryLive<T extends DocTypes>(
    mapFn: MapFnArg<T>,
    opts?: QueryOpts
  ): Promise<{ result: QueryResponse<T>; serverDocs: DocWithId<T>[] }>;
  materializeLive<T extends DocTypes>(serverDocs: DocWithId<T>[], mapFn: MapFnArg<T>, opts?: QueryOpts): QueryResponse<T>;
  allDocs<T extends DocTypes>(opts?: {
    limit?: number;
    offset?: number;
    descending?: boolean;
  }): Promise<{ rows: IndexRow<T>[]; docs: DocWithId<T>[] }>;
  changes<T extends DocTypes>(): Promise<{ rows: IndexRow<T>[]; docs: DocWithId<T>[] }>;
  subscribe<T extends DocTypes>(listener: ListenerFn<T>, updates?: boolean): () => void;
  resubscribe(): void;
  // Ephemeral presence broadcast (#1756). Optional: FireflyDatabase relays to
  // peers; LocalDatabase (anonymous local mode) has no peers and omits it.
  broadcastEphemeral?(docId: string, doc: Record<string, unknown>, dbName?: string): void;
}

/**
 * Run a Fireproof-style mapFn over a doc list and apply key/keys/range/prefix/
 * descending/limit filters. Pure — no I/O. Shared by FireflyDatabase (over
 * server docs + optimistic overlay) and LocalDatabase (over localStorage docs),
 * so the full query surface is identical in both — apps swapping modes see the
 * same index behavior (#2988).
 */
export function materializeQuery<T extends DocTypes>(
  allDocs: DocWithId<T>[],
  mapFn: MapFnArg<T>,
  opts: QueryOpts
): QueryResponse<T> {
  // Build index entries — keys stored as charwise-encoded strings for correct sort
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let encodedRows: { encodedKey: string; decodedKey: any; value: DocWithId<T>; doc?: DocWithId<T> }[];

  if (typeof mapFn === "string") {
    // String field name — filter docs that have this field, key = field value
    encodedRows = allDocs
      .filter((doc) => doc[mapFn] !== undefined)
      .map((doc) => ({
        encodedKey: encodeKey(doc[mapFn]) as string,
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
            encodedKey: encodeKey(key) as string,
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
            encodedKey: encodeKey(mapReturn) as string,
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
      encodedKey: encodeKey(doc._id) as string,
      decodedKey: doc._id,
      value: doc,
      doc: opts.includeDocs ? doc : undefined,
    }));
  }

  // Apply query filters using charwise-encoded comparisons
  if (opts.key !== undefined) {
    const encodedKey = encodeKey(opts.key) as string;
    encodedRows = encodedRows.filter((r) => r.encodedKey === encodedKey);
  }
  if (opts.keys !== undefined) {
    const encodedKeys = new Set(opts.keys.map((k: unknown) => encodeKey(k) as string));
    encodedRows = encodedRows.filter((r) => encodedKeys.has(r.encodedKey));
  }
  if (opts.range) {
    const encodedStart = encodeKey(opts.range[0]) as string;
    const encodedEnd = encodeKey(opts.range[1]) as string;
    encodedRows = encodedRows.filter((r) => r.encodedKey >= encodedStart && r.encodedKey <= encodedEnd);
  }
  if (opts.prefix !== undefined) {
    // For array prefixes, strip the trailing "!" so [2024,11] matches [2024,11,15]
    let encodedPrefix = encodeKey(opts.prefix) as string;
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

function errMsg(err: Error): string {
  const e = err as Error & { error?: { message?: string } };
  return e.error?.message ?? e.message ?? String(e);
}

// Receiver-side backstop for ephemeral presence slices (#1756). The primary
// cleanup is the evt-doc-ephemeral-drop on disconnect; this bounds slices from
// an unclean disconnect (tab crash, network drop) so stale cursors vanish.
const EPHEMERAL_TTL_MS = 12_000;

// Sentinel "allow every channel" set used when the viewer's granted-channel set
// hasn't been wired into this Database (allow-by-default — server routing is the
// real gate; a missing set must NOT drop all channel ephemerals, per #1756 P1).
// TODO(#1756): wire the real granted set from VibeContext
// mountParams.viewerEnv.grants[dbName] via setGrantedChannels() so the client
// gate tightens to the viewer's actual channels.
const EPHEMERAL_ALLOW_ALL: Set<string> = {
  has: () => true,
} as unknown as Set<string>;

interface EphemeralSlice {
  doc: DocWithId;
  originPeer: string;
  seq: number;
  at: number;
}

export class FireflyDatabase {
  readonly name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly logger: any = fireflyLogger;

  private readonly vibeApi: FireflyTransport;
  private readonly vibeApp: VibeApp;
  private readonly listeners = new Set<ListenerFn>();
  private readonly updateListeners = new Set<ListenerFn>();

  // Optimistic-write layer (#2985). While a put/del is in flight, its effect is
  // reflected here so live queries update instantly instead of waiting for the
  // write to round-trip and echo back. Entries are keyed by `_id` and cleared
  // when the server confirms (authoritative doc takes over) or the write fails
  // (rolled back). Off at the raw-DB level to keep standalone/script notify
  // semantics unchanged; useFireproof turns it on by default (opt out with
  // useFireproof(db, { optimistic: false })).
  private optimisticEnabled = false;
  private readonly overlay = new Map<string, OverlayEntry>();
  // Monotonic per-write token so a resolving/failing write only touches the
  // overlay entry it still owns — see clearOverlay (#2985).
  private writeSeq = 0;

  // Ephemeral presence overlay (#1756): in-memory only, never persisted. Keyed
  // by _id; peerDocs indexes each originPeer's slices for O(1) drop-on-disconnect.
  // Layering vs the optimistic overlay (#2985): ephemeral folds over the
  // persisted/server view, and the LOCAL optimistic overlay folds over both —
  // an in-flight local write for the same _id beats a remote peer's ephemeral
  // ("local setDoc wins for self"); the server echo then reconciles.
  private readonly ephemeralOverlay = new Map<string, EphemeralSlice>();
  private readonly peerDocs = new Map<string, Set<string>>();
  private ephemeralSeq = 0;
  // Lazy sweep timer that proactively expires stale slices even with no other DB
  // activity (#1756): the TTL backstop's whole point is the unclean-disconnect
  // case where no evt-doc-ephemeral-drop arrives. Started on the first slice,
  // stopped when the overlay empties, so an idle db holds no timer.
  private ephemeralSweep: ReturnType<typeof setInterval> | undefined;
  // Optional set of channels the viewer may currently read. Defense-in-depth for
  // the inbound channel gate; server routing is the primary guarantee. Undefined
  // means "allow" (see readableChannels()).
  private grantedChannels: Set<string> | undefined;

  constructor(name: string, vibeApi: FireflyTransport, acl?: DbAcl) {
    this.name = name;
    this.vibeApi = vibeApi;
    this.vibeApp = vibeApi.svc.vibeApp;

    // Subscribe to remote doc-changed events for THIS db (cross-client sync).
    // Each FireflyDatabase subscribes for its own name — otherwise apps using a
    // non-"default" dbName get zero subscribers on the server side and never
    // receive notifications. Fire-and-forget; the client-side subscribeDocs
    // deduplicates by key, so re-calls stay safe.
    this.resubscribe();

    if (acl) {
      this.applyAcl(acl);
    }

    // Listen for remote doc-changed events (cross-client sync). Filter on
    // dbName so a sibling FireflyDatabase on the same connection (e.g. the
    // comments db on the same vibe) doesn't trigger spurious reloads here.
    this.vibeApi.onMsg((event) => {
      const { data } = event;
      if (
        isEvtDocChanged(data) &&
        data.ownerHandle === this.vibeApp.ownerHandle &&
        data.appSlug === this.vibeApp.appSlug &&
        data.dbName === this.name
      ) {
        this.notifyListeners([{ _id: data.docId } as DocWithId]);
      }
      // Ephemeral presence (#1756): fold an inbound snapshot into the overlay,
      // matched on ownerHandle/appSlug/dbName like the evt-doc-changed filter.
      if (
        isEvtDocEphemeral(data) &&
        data.ownerHandle === this.vibeApp.ownerHandle &&
        data.appSlug === this.vibeApp.appSlug &&
        data.dbName === this.name
      ) {
        // Defense-in-depth (#1756 P1): server routing is the primary gate; also
        // drop an ephemeral whose channel isn't currently readable. A
        // channel-absent ephemeral (non-access-fn vibe) is always allowed.
        if (!data.channel || this.readableChannels().has(data.channel)) {
          this.applyEphemeral(data);
        }
      }
      if (isEvtDocEphemeralDrop(data)) {
        this.dropPeer(data.originPeer);
      }
    });
  }

  /**
   * Re-issue the doc subscription so the server refreshes this connection's
   * channel snapshot — e.g. after the viewer's grants change and new channels
   * become readable. Safe to call repeatedly; subscribeDocs dedupes by key.
   */
  resubscribe(): void {
    // Best-effort: subscribeDocs can reject (not just return Err) when the
    // underlying connection fails — e.g. a db opened with a bad apiUrl. Handle
    // both so a fire-and-forget resubscribe never becomes an unhandled
    // rejection that crashes the process; next activity retries (#2444).
    this.vibeApi
      .subscribeDocs(this.name)
      .then((rRes) => {
        if (rRes.isErr()) {
          console.error(`Failed to subscribe to docs for db "${this.name}":`, rRes.Err());
        }
      })
      .catch((e: unknown) => {
        console.error(`Failed to subscribe to docs for db "${this.name}":`, e);
      });
  }

  // Ephemeral presence broadcast (#1756): emit-only, fire-and-forget. Delegates
  // to the transport's broadcastEphemeral. Never persists, never awaits.
  broadcastEphemeral(docId: string, doc: Record<string, unknown>): void {
    this.vibeApi.broadcastEphemeral(docId, doc, this.name);
  }

  applyAcl(acl: DbAcl): void {
    this.vibeApi.setDbAcl(this.name, acl).then((rRes) => {
      if (rRes.isErr()) {
        console.error(`setDbAcl request failed for db "${this.name}":`, rRes.Err());
        return;
      }
      if (rRes.Ok().status === "error") {
        console.error(`setDbAcl server error for db "${this.name}": ${rRes.Ok().message ?? "unknown"}`);
      }
    });
  }

  /**
   * Toggle the optimistic-write layer for this database (#2985). Called by
   * useFireproof from the { optimistic } option; on by default.
   *
   * Note: FireflyDatabase instances are cached per db name and shared between
   * useFireproof() and the standalone fireproof() factory, so this is a
   * process-wide-per-db, last-writer-wins setting. A raw fireproof(name) handle
   * in a runtime where useFireproof(name) has mounted inherits the hook's mode
   * (i.e. optimism on). That's intentional — optimism is a property of the db,
   * not the call site — but callers that need the raw single-notification
   * semantics should pass useFireproof(name, { optimistic: false }) or avoid
   * mixing the two APIs on the same db name.
   */
  setOptimistic(enabled: boolean): void {
    this.optimisticEnabled = enabled;
    if (!enabled) this.overlay.clear();
  }

  async ready(): Promise<void> {
    return;
  }

  async close(): Promise<void> {
    if (this.ephemeralSweep) {
      clearInterval(this.ephemeralSweep);
      this.ephemeralSweep = undefined;
    }
    return;
  }

  async destroy(): Promise<void> {
    return;
  }

  async compact(): Promise<void> {
    return;
  }

  async get<T extends DocTypes>(id: string): Promise<DocWithId<T>> {
    // Serve a pending optimistic write from the overlay so useDocument.refresh()
    // (and any direct get) reflects it before the server confirms (#2985). A
    // local in-flight write beats a remote ephemeral for the same _id.
    const pending = this.overlay.get(id);
    if (pending) {
      if (pending.kind === "del") throw new Error(`Failed to get document: ${id} (optimistically deleted)`);
      return pending.doc as DocWithId<T>;
    }
    // #1756: fold any live ephemeral slice over the persisted doc (slice wins
    // per LWW), or return the slice alone when nothing is persisted.
    this.pruneEphemeral();
    const eph = this.ephemeralOverlay.get(id);
    const rRes = await this.vibeApi.getDoc(id, this.name);
    if (rRes.isErr()) {
      if (eph) return { ...eph.doc } as DocWithId<T>; // ephemeral-only
      throw new Error(`Failed to get document: ${errMsg(rRes.Err())}`);
    }
    const res = rRes.Ok();
    if (isResGetDoc(res)) {
      // Stage B Phase 8: decorate _files entries with a meta.file() shim
      // so consumers can `await meta.file()` for raw bytes. Pass-through
      // when _files is absent. The server-minted meta.url is preserved.
      const decorated = decorateFiles({ ...res.doc, _id: res.id });
      return { ...decorated, ...(eph ? eph.doc : {}) } as DocWithId<T>;
    }
    if (eph) return { ...eph.doc } as DocWithId<T>; // not-found but overlaid
    throw new Error(`Failed to get document: ${JSON.stringify(res)}`);
  }

  async put<T extends DocTypes>(doc: T & { _id?: string }): Promise<DocResponse> {
    // Optimistic layer (#2985): reflect the write in live queries immediately,
    // before it round-trips. Mint the id client-side (server honors a provided
    // docId) so the optimistic entry and the confirmed doc share one id — no
    // key churn when the authoritative doc takes over.
    const optimistic = this.optimisticEnabled;
    const id = doc._id ?? (optimistic ? newOptimisticId() : undefined);
    const token = ++this.writeSeq;
    if (optimistic && id !== undefined) {
      // decorateFiles is a no-op when there are no _files; a doc with raw
      // File/Blob entries still renders from the caller's own state until the
      // confirmed doc (with server-minted meta.url) replaces it.
      const optimisticDoc = decorateFiles({ ...doc, _id: id }) as DocWithId;
      this.overlay.set(id, { kind: "put", doc: optimisticDoc, token });
      this.notifyListeners([optimisticDoc], { optimistic: true });
    }
    try {
      // Stage B Phase 8: walk _files, replace File/Blob entries with the
      // {uploadId, type, size, lastModified} shape via put-asset round-trips
      // BEFORE serializing the doc across postMessage. Without this, File
      // becomes {} on JSON.stringify and the put silently drops the file
      // (or, in the cement WS encoder, times out — the user-visible
      // "Request idle for 10000ms" failure mode the og/files-regression
      // demo gate exhibits today).
      const docToPut = await uploadFiles(doc, this.vibeApi as unknown as AssetUploader);
      const rRes = await this.vibeApi.putDoc(docToPut as Record<string, unknown>, id, this.name);
      if (rRes.isErr()) {
        throw new Error(`Failed to put document: ${errMsg(rRes.Err())}`);
      }
      const res = rRes.Ok();
      if (!isResPutDoc(res)) {
        throw new Error(`Failed to put document: ${JSON.stringify(res)}`);
      }
      // Confirmed: drop the optimistic entry (only if a newer overlapping write
      // hasn't superseded it) and let the authoritative doc take over.
      // notifyListeners triggers the live query's server refresh, which now
      // returns the persisted doc — no flicker when they match.
      if (id !== undefined) this.clearOverlay(id, token);
      const savedDoc = { ...docToPut, _id: res.id } as DocWithId<T>;
      this.notifyListeners([savedDoc]);
      return { id: res.id, ok: true };
    } catch (err) {
      this.rollback(id, token);
      throw err;
    }
  }

  async del(id: string): Promise<DocResponse> {
    const optimistic = this.optimisticEnabled;
    const token = ++this.writeSeq;
    if (optimistic) {
      this.overlay.set(id, { kind: "del", token });
      this.notifyListeners([{ _id: id, _deleted: true } as DocWithId], { optimistic: true });
    }
    try {
      const rRes = await this.vibeApi.deleteDoc(id, this.name);
      if (rRes.isErr()) {
        throw new Error(`Failed to delete document: ${errMsg(rRes.Err())}`);
      }
      const res = rRes.Ok();
      if (!isResDeleteDoc(res)) {
        throw new Error(`Failed to delete document: ${JSON.stringify(res)}`);
      }
      if (optimistic) this.clearOverlay(id, token);
      this.notifyListeners([{ _id: res.id, _deleted: true } as DocWithId]);
      return { id: res.id, ok: true };
    } catch (err) {
      this.rollback(id, token);
      throw err;
    }
  }

  /**
   * Drop an overlay entry only if the given write still owns it. When two
   * writes for the same _id overlap (rapid toggle / autosave), the later one
   * overwrites the entry with a new token; an earlier write resolving or
   * failing must NOT clobber that newer pending value — so it clears only on a
   * token match, leaving the newer write's overlay in place (#2985).
   */
  private clearOverlay(id: string, token: number): boolean {
    if (this.overlay.get(id)?.token !== token) return false;
    this.overlay.delete(id);
    return true;
  }

  /**
   * Undo a pending optimistic entry after its write failed (access denied,
   * conflict, network) and notify so live queries revert — the UI never
   * silently lies. No-op when the entry was already cleared/confirmed or a
   * newer write has since superseded it (that newer write is now the intended
   * state and stays pending) (#2985).
   */
  private rollback(id: string | undefined, token: number): void {
    if (id === undefined || !this.clearOverlay(id, token)) return;
    this.notifyListeners([{ _id: id } as DocWithId], { optimistic: true });
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

  async query<T extends DocTypes>(mapFn: MapFnArg<T>, opts: QueryOpts = {}): Promise<QueryResponse<T>> {
    const serverDocs = await this.fetchServerDocs<T>(this.queryHint(mapFn, opts));
    return materializeQuery(this.foldOverlays(serverDocs), mapFn, opts);
  }

  /**
   * Like query() but also returns the raw (pre-overlay) server docs it fetched,
   * so useLiveQuery can cache them and re-materialize instantly against the
   * optimistic overlay on a local write — no extra round-trip (#2985).
   */
  async queryLive<T extends DocTypes>(
    mapFn: MapFnArg<T>,
    opts: QueryOpts = {}
  ): Promise<{ result: QueryResponse<T>; serverDocs: DocWithId<T>[] }> {
    const serverDocs = await this.fetchServerDocs<T>(this.queryHint(mapFn, opts));
    return { result: materializeQuery(this.foldOverlays(serverDocs), mapFn, opts), serverDocs };
  }

  /**
   * Synchronous re-materialization from already-fetched server docs plus the
   * current overlay — the instant optimistic path used by useLiveQuery, no
   * network (#2985). Also folds live ephemeral slices (#1756), so a presence
   * update re-materializes from cached serverDocs without a round-trip.
   */
  materializeLive<T extends DocTypes>(serverDocs: DocWithId<T>[], mapFn: MapFnArg<T>, opts: QueryOpts = {}): QueryResponse<T> {
    return materializeQuery(this.foldOverlays(serverDocs), mapFn, opts);
  }

  /**
   * Layer both overlays over raw server docs: ephemeral presence slices (#1756)
   * fold over the server view (synthesizing rows for ephemeral-only _ids), then
   * the local optimistic overlay (#2985) folds over both — an in-flight local
   * write for the same _id beats a remote peer's ephemeral.
   */
  private foldOverlays<T extends DocTypes>(serverDocs: DocWithId<T>[]): DocWithId<T>[] {
    return this.applyOverlay(this.mergeOverlayDocs(serverDocs));
  }

  /** Build the server-side query filter hint from a string mapFn + primitive opts. */
  private queryHint<T extends DocTypes>(mapFn: MapFnArg<T>, opts: QueryOpts): QueryFilter | undefined {
    const isPrimitive = (v: unknown): v is string | number | boolean | null =>
      v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
    if (typeof mapFn !== "string") return undefined;
    const keyHint = opts.key !== undefined && isPrimitive(opts.key) ? { key: opts.key } : {};
    const keysHint =
      opts.keys !== undefined && opts.keys.every(isPrimitive) ? { keys: opts.keys as (string | number | boolean | null)[] } : {};
    const rangeHint =
      opts.range !== undefined && isPrimitive(opts.range[0]) && isPrimitive(opts.range[1])
        ? { range: opts.range as [unknown, unknown] }
        : {};
    if (keyHint.key !== undefined || keysHint.keys !== undefined || rangeHint.range !== undefined) {
      return { field: mapFn, ...keyHint, ...keysHint, ...rangeHint };
    }
    return undefined;
  }

  /** Fetch this db's docs from the server (honoring an optional filter hint) and decorate _files. */
  private async fetchServerDocs<T extends DocTypes>(hint: QueryFilter | undefined): Promise<DocWithId<T>[]> {
    const rRes = await this.vibeApi.queryDocs(this.name, hint);
    if (rRes.isErr()) {
      throw new Error(`Failed to query documents: ${errMsg(rRes.Err())}`);
    }
    const res = rRes.Ok();
    if (!isResQueryDocs(res)) {
      return [];
    }
    // Stage B Phase 8: decorate every doc's _files entries with a
    // meta.file() shim. URL is server-minted, so this only adds the
    // shim — pass-through when _files is absent.
    // NOTE: returns RAW server docs — no ephemeral (#1756) or optimistic (#2985)
    // fold here. queryLive's callers cache this list and re-materialize against
    // the LIVE overlays on every notify; folding here would freeze stale
    // ephemeral slices into that cache. The folds happen at materialize time.
    return res.docs.map((d) => decorateFiles({ ...d, _id: d._id }) as DocWithId<T>);
  }

  /**
   * Merge the pending optimistic overlay onto a raw server doc list (#2985):
   * puts replace/insert, dels remove. Returns the input untouched when the
   * overlay is empty (the common, no-write-in-flight case).
   */
  private applyOverlay<T extends DocTypes>(serverDocs: DocWithId<T>[]): DocWithId<T>[] {
    if (this.overlay.size === 0) return serverDocs;
    const byId = new Map<string, DocWithId<T>>(serverDocs.map((d) => [d._id, d]));
    for (const [id, entry] of this.overlay) {
      if (entry.kind === "del") byId.delete(id);
      else byId.set(id, entry.doc as DocWithId<T>);
    }
    return [...byId.values()];
  }

  async allDocs<T extends DocTypes>(
    opts: { limit?: number; offset?: number; descending?: boolean } = {}
  ): Promise<{ rows: IndexRow<T>[]; docs: DocWithId<T>[] }> {
    const rRes = await this.vibeApi.queryDocs(this.name);
    if (rRes.isErr()) {
      throw new Error(`Failed to query documents: ${errMsg(rRes.Err())}`);
    }
    const res = rRes.Ok();
    if (!isResQueryDocs(res)) {
      return { rows: [], docs: [] };
    }

    // Stage B Phase 8: same _files decoration as in query().
    // foldOverlays layers ephemeral slices (#1756) then pending optimistic
    // writes (#2985) over the server rows.
    let docs = this.foldOverlays(res.docs.map((d) => decorateFiles({ ...d, _id: d._id }) as DocWithId<T>));

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

  // ── Ephemeral presence overlay (#1756) ─────────────────────────────

  /**
   * Update the set of channels the viewer may currently read, for the inbound
   * defense-in-depth gate. Pass undefined to fall back to allow-by-default.
   * Server routing remains the primary guarantee; this only tightens the client.
   */
  setGrantedChannels(channels: Set<string> | undefined): void {
    this.grantedChannels = channels;
  }

  private readableChannels(): Set<string> {
    // Allow-by-default: if the runtime hasn't wired the viewer's granted set,
    // return undefined-as-"allow" — represented here by a Set that reports true
    // for any lookup. We can't build an infinite Set, so callers guard with a
    // sentinel: when grantedChannels is undefined we never reach a .has() that
    // could wrongly drop, because applyEphemeral's caller only consults this set
    // when grantedChannels is defined. See the onMsg gate.
    return this.grantedChannels ?? EPHEMERAL_ALLOW_ALL;
  }

  private pruneEphemeral(): string[] {
    const now = Date.now();
    const dropped: string[] = [];
    for (const [docId, slice] of this.ephemeralOverlay) {
      if (now - slice.at > EPHEMERAL_TTL_MS) {
        this.ephemeralOverlay.delete(docId);
        this.peerDocs.get(slice.originPeer)?.delete(docId);
        dropped.push(docId);
      }
    }
    return dropped;
  }

  private applyEphemeral(evt: EvtDocEphemeral): void {
    const docId = evt.docId;
    const doc = { ...evt.doc, _id: docId } as DocWithId;
    this.ephemeralOverlay.set(docId, { doc, originPeer: evt.originPeer, seq: ++this.ephemeralSeq, at: Date.now() });
    let set = this.peerDocs.get(evt.originPeer);
    if (!set) {
      set = new Set();
      this.peerDocs.set(evt.originPeer, set);
    }
    set.add(docId);
    this.ensureEphemeralSweep();
    this.notifyListeners([{ _id: docId } as DocWithId]);
  }

  // Start the sweep if not already running. Each tick prunes expired slices and
  // repaints (notifyListeners) so an unclean-disconnect cursor actually vanishes
  // in a quiescent room; stops itself once the overlay is empty.
  private ensureEphemeralSweep(): void {
    if (this.ephemeralSweep) return;
    this.ephemeralSweep = setInterval(() => {
      const dropped = this.pruneEphemeral();
      if (dropped.length) this.notifyListeners(dropped.map((id) => ({ _id: id }) as DocWithId));
      if (this.ephemeralOverlay.size === 0 && this.ephemeralSweep) {
        clearInterval(this.ephemeralSweep);
        this.ephemeralSweep = undefined;
      }
    }, EPHEMERAL_TTL_MS);
    // Don't keep a Node process (tests, node/wrangler consumers) alive on the timer.
    (this.ephemeralSweep as { unref?: () => void }).unref?.();
  }

  private dropPeer(originPeer: string): void {
    const docs = this.peerDocs.get(originPeer);
    if (!docs) return;
    const affected: DocWithId[] = [];
    for (const docId of docs) {
      const slice = this.ephemeralOverlay.get(docId);
      if (slice && slice.originPeer === originPeer) {
        this.ephemeralOverlay.delete(docId);
        affected.push({ _id: docId } as DocWithId);
      }
    }
    this.peerDocs.delete(originPeer);
    if (affected.length) this.notifyListeners(affected);
  }

  // Fold overlay slices over a list of persisted docs: merge onto a matching
  // persisted doc by _id (overlay wins per LWW), and append synthesized rows for
  // overlay-only _ids so useLiveQuery sees them. Prunes expired slices first.
  private mergeOverlayDocs<T extends DocTypes>(docs: DocWithId<T>[]): DocWithId<T>[] {
    this.pruneEphemeral();
    if (this.ephemeralOverlay.size === 0) return docs;
    const byId = new Map(docs.map((d) => [d._id, d] as const));
    for (const [docId, slice] of this.ephemeralOverlay) {
      const base = byId.get(docId);
      byId.set(docId, { ...(base ?? {}), ...slice.doc, _id: docId } as DocWithId<T>);
    }
    return [...byId.values()];
  }

  // Notify subscribers after mutations. `meta.optimistic` marks a local
  // optimistic write so useLiveQuery can re-materialize instantly (#2985).
  // Only pass meta when present so non-optimistic notifications keep their
  // original single-argument call shape.
  private notifyListeners(docs: DocWithId[], meta?: ChangeMeta): void {
    const call = (fn: ListenerFn) => {
      try {
        if (meta === undefined) fn(docs);
        else fn(docs, meta);
      } catch {
        // Don't let a failing listener break others
      }
    };
    for (const fn of this.listeners) call(fn);
    for (const fn of this.updateListeners) call(fn);
  }
}
