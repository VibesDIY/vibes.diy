/**
 * Mock VibeSandboxApi for testing FireflyDatabase and useFireproof hooks.
 * In-memory document store with proper Result wrapping.
 */
import { Result } from "@adviser/cement";
import type { VibeSandboxApi } from "../../vibe/runtime/register-dependencies.js";

type MsgListener = (event: { data: unknown }) => void;

export interface MockVibeApi {
  svc: { vibeApp: { appSlug: string; userSlug: string } };
  putDoc(doc: Record<string, unknown>, docId?: string): Promise<Result<unknown>>;
  getDoc(docId: string): Promise<Result<unknown>>;
  queryDocs(): Promise<Result<unknown>>;
  deleteDoc(docId: string): Promise<Result<unknown>>;
  subscribeDocs(dbName?: string): Promise<Result<unknown>>;
  putAsset(blob: Blob, mimeType?: string): Promise<Result<unknown>>;
  onMsg: (fn: MsgListener) => void;
  /** Test helper: simulate server-push evt-doc-changed */
  _simulateDocChanged(docId: string, dbName?: string): void;
  /** Test helper: access raw doc store */
  _docs: Map<string, Record<string, unknown>>;
  /** Test helper: dbNames passed to every subscribeDocs() call (in order) */
  _subscribeDocsCalls: string[];
  /** Test helper: putAsset call log */
  _putAssetCalls: { size: number; type: string; mimeType?: string }[];
}

let idCounter = 0;

export function createMockVibeApi(appSlug = "test-app"): MockVibeApi {
  const docs = new Map<string, Record<string, unknown>>();
  const msgListeners: MsgListener[] = [];
  const subscribeDocsCalls: string[] = [];
  const putAssetCalls: { size: number; type: string; mimeType?: string }[] = [];
  let nextUploadId = 0;

  return {
    svc: { vibeApp: { appSlug, userSlug: "test-user" } },

    putDoc: async (doc: Record<string, unknown>, docId?: string) => {
      // Time-sortable ID: hex timestamp + monotonic counter (mirrors sthis.nextId() behavior)
      const id = docId ?? `${Date.now().toString(16)}-${(++idCounter).toString(16).padStart(8, "0")}`;
      docs.set(id, { ...doc, _id: id });
      return Result.Ok({ type: "vibes.diy.res-put-doc" as const, status: "ok" as const, id });
    },

    getDoc: async (id: string) => {
      const doc = docs.get(id);
      if (!doc) {
        // Real API times out when doc not found (isResGetDoc doesn't match not-found status).
        // FireflyDatabase.get() catches rRes.isErr() and throws.
        return Result.Err(`Document not found: ${id}`);
      }
      return Result.Ok({
        type: "vibes.diy.res-get-doc" as const,
        status: "ok" as const,
        id,
        doc: { ...doc },
      });
    },

    queryDocs: async () => {
      const allDocs = [...docs.values()].map((d) => ({ ...d, _id: d._id as string }));
      return Result.Ok({
        type: "vibes.diy.res-query-docs" as const,
        status: "ok" as const,
        docs: allDocs,
      });
    },

    deleteDoc: async (id: string) => {
      docs.delete(id);
      return Result.Ok({ type: "vibes.diy.res-delete-doc" as const, status: "ok" as const, id });
    },

    subscribeDocs: async (dbName = "default") => {
      subscribeDocsCalls.push(dbName);
      return Result.Ok({ type: "vibes.diy.res-subscribe-docs" as const, status: "ok" as const });
    },

    putAsset: async (blob: Blob, mimeType?: string) => {
      const call: { size: number; type: string; mimeType?: string } = {
        size: blob.size,
        type: blob.type,
        ...(mimeType ? { mimeType } : {}),
      };
      putAssetCalls.push(call);
      const uploadId = `upl-mock-${++nextUploadId}`;
      return Result.Ok({
        type: "vibe.res.putAsset" as const,
        status: "ok" as const,
        cid: `cid-mock-${nextUploadId}`,
        getURL: `s3://r2/cid-mock-${nextUploadId}`,
        size: blob.size,
        uploadId,
      });
    },

    onMsg: (fn: MsgListener) => {
      msgListeners.push(fn);
    },

    _simulateDocChanged: (docId: string, dbName = "testdb") => {
      for (const fn of msgListeners) {
        fn({ data: { type: "vibes.diy.evt-doc-changed", userSlug: "test-user", appSlug, dbName, docId } });
      }
    },

    _docs: docs,
    _subscribeDocsCalls: subscribeDocsCalls,
    _putAssetCalls: putAssetCalls,
  };
}

/** Cast MockVibeApi to VibeSandboxApi for passing to FireflyDatabase */
export function asSandboxApi(mock: MockVibeApi): VibeSandboxApi {
  return mock as unknown as VibeSandboxApi;
}
