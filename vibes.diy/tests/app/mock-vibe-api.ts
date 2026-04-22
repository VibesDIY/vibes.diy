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
  subscribeDocs(): Promise<Result<unknown>>;
  onMsg: (fn: MsgListener) => void;
  /** Test helper: simulate server-push evt-doc-changed */
  _simulateDocChanged(docId: string): void;
  /** Test helper: access raw doc store */
  _docs: Map<string, Record<string, unknown>>;
}

let idCounter = 0;

export function createMockVibeApi(appSlug = "test-app"): MockVibeApi {
  const docs = new Map<string, Record<string, unknown>>();
  const msgListeners: MsgListener[] = [];

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

    subscribeDocs: async () => Result.Ok({ type: "vibes.diy.res-subscribe-docs" as const, status: "ok" as const }),

    onMsg: (fn: MsgListener) => {
      msgListeners.push(fn);
    },

    _simulateDocChanged: (docId: string) => {
      for (const fn of msgListeners) {
        fn({ data: { type: "vibes.diy.evt-doc-changed", appSlug, docId } });
      }
    },

    _docs: docs,
  };
}

/** Cast MockVibeApi to VibeSandboxApi for passing to FireflyDatabase */
export function asSandboxApi(mock: MockVibeApi): VibeSandboxApi {
  return mock as unknown as VibeSandboxApi;
}
