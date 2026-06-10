import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useFireproof, registerFirefly } from "../../vibe/runtime/use-firefly.js";
import { FireflyDatabase } from "../../vibe/runtime/firefly-database.js";
import { VibeContextProvider } from "../../vibe/runtime/VibeContext.js";
import { createMockVibeApi, asSandboxApi, type MockVibeApi } from "./mock-vibe-api.js";

const TEST_TIMEOUT = 5000;
let mockApi: MockVibeApi;
let testCounter = 0;

// Unique db name per test to avoid cache collisions
function uniqueDbName() {
  return `test-db-${++testCounter}`;
}

beforeAll(async () => {
  mockApi = createMockVibeApi("test-app");
  await registerFirefly(asSandboxApi(mockApi));
});

// ── useFireproof basics ─────────────────────────────────────────────

describe("HOOK: useFireproof", () => {
  it(
    "should be defined",
    () => {
      expect(useFireproof).toBeDefined();
    },
    TEST_TIMEOUT
  );

  it(
    "returns database, useLiveQuery, useDocument, useAllDocs, useChanges",
    () => {
      renderHook(() => {
        const result = useFireproof(uniqueDbName());
        expect(typeof result.useLiveQuery).toBe("function");
        expect(typeof result.useDocument).toBe("function");
        expect(typeof result.useAllDocs).toBe("function");
        expect(typeof result.useChanges).toBe("function");
        expect(result.database).toBeInstanceOf(FireflyDatabase);
      });
    },
    TEST_TIMEOUT
  );

  it(
    "database instance stable across renders",
    () => {
      const dbName = uniqueDbName();
      let firstDb: FireflyDatabase | undefined;

      const { rerender } = renderHook(() => {
        const { database } = useFireproof(dbName);
        if (!firstDb) {
          firstDb = database;
        } else {
          expect(database).toBe(firstDb);
        }
      });

      rerender();
      rerender();
      rerender();
    },
    TEST_TIMEOUT
  );
});

// ── useDocument ─────────────────────────────────────────────────────

describe("HOOK: useDocument", () => {
  let dbName: string;
  let useDocument: ReturnType<typeof useFireproof>["useDocument"];

  beforeEach(() => {
    dbName = uniqueDbName();
    const result = renderHook(() => useFireproof(dbName)).result;
    useDocument = result.current.useDocument;
  });

  it(
    "initializes with empty doc",
    () => {
      const { result } = renderHook(() => useDocument({ input: "" }));
      expect(result.current.doc.input).toBe("");
      expect(result.current.doc._id).toBeUndefined();
    },
    TEST_TIMEOUT
  );

  it(
    "merge updates doc fields",
    async () => {
      const { result } = renderHook(() => useDocument({ input: "" }));

      act(() => {
        result.current.merge({ input: "updated" });
      });

      await waitFor(() => {
        expect(result.current.doc.input).toBe("updated");
      });
    },
    TEST_TIMEOUT
  );

  it(
    "save persists and assigns _id",
    async () => {
      const { result } = renderHook(() => useDocument({ input: "save-me" }));

      await act(async () => {
        await result.current.save();
      });

      await waitFor(() => {
        expect(result.current.doc._id).toBeDefined();
      });
    },
    TEST_TIMEOUT
  );

  it(
    "reset clears to initial doc",
    async () => {
      const { result } = renderHook(() => useDocument({ input: "initial" }));

      act(() => {
        result.current.merge({ input: "changed" });
      });

      await waitFor(() => {
        expect(result.current.doc.input).toBe("changed");
      });

      act(() => {
        result.current.reset();
      });

      await waitFor(() => {
        expect(result.current.doc.input).toBe("initial");
      });
    },
    TEST_TIMEOUT
  );

  it(
    "remove deletes document",
    async () => {
      const { result } = renderHook(() => useDocument({ input: "to-remove" }));

      // Save first to get an _id
      await act(async () => {
        await result.current.save();
      });

      await waitFor(() => {
        expect(result.current.doc._id).toBeDefined();
      });

      const id = result.current.doc._id;

      await act(async () => {
        await result.current.remove();
      });

      // Doc should be removed from store
      expect(mockApi._docs.has(id as string)).toBe(false);
    },
    TEST_TIMEOUT
  );

  it(
    "submit saves then resets",
    async () => {
      const { result } = renderHook(() => useDocument({ input: "" }));

      act(() => {
        result.current.merge({ input: "submitted" });
      });

      await act(async () => {
        await result.current.submit();
      });

      await waitFor(() => {
        // After submit, doc should be reset to initial (no _id, empty input)
        expect(result.current.doc._id).toBeUndefined();
        expect(result.current.doc.input).toBe("");
      });

      // But the doc should exist in the store
      expect(mockApi._docs.size).toBeGreaterThan(0);
    },
    TEST_TIMEOUT
  );
});

// ── useDocument with existing doc ───────────────────────────────────

describe("HOOK: useDocument with existing doc", () => {
  it(
    "loads existing document by _id",
    async () => {
      const dbName = uniqueDbName();
      const { result: fpResult } = renderHook(() => useFireproof(dbName));
      const database = fpResult.current.database;

      // Put a doc directly
      const { id } = await database.put({ input: "existing" });

      const { result } = renderHook(() => fpResult.current.useDocument({ _id: id }));

      await waitFor(() => {
        expect(result.current.doc._id).toBe(id);
        expect(result.current.doc.input).toBe("existing");
      });
    },
    TEST_TIMEOUT
  );
});

// ── useLiveQuery ────────────────────────────────────────────────────

describe("HOOK: useLiveQuery", () => {
  let dbName: string;
  let database: FireflyDatabase;
  let useLiveQuery: ReturnType<typeof useFireproof>["useLiveQuery"];

  beforeAll(async () => {
    dbName = uniqueDbName();
    const { result } = renderHook(() => useFireproof(dbName));
    database = result.current.database;
    useLiveQuery = result.current.useLiveQuery;

    await database.put({ _id: "a", foo: "apple" });
    await database.put({ _id: "b", foo: "banana" });
    await database.put({ _id: "c", foo: "cherry" });
  });

  it(
    "queries by string field correctly",
    async () => {
      const { result } = renderHook(() => useLiveQuery("foo"));

      await waitFor(() => {
        expect(result.current.rows.length).toBe(3);
        const values = result.current.docs.map((d: Record<string, unknown>) => d.foo);
        expect(values).toContain("apple");
        expect(values).toContain("banana");
        expect(values).toContain("cherry");
      });
    },
    TEST_TIMEOUT
  );

  it(
    "updates when database changes",
    async () => {
      const { result } = renderHook(() => useLiveQuery("foo"));

      await waitFor(() => {
        expect(result.current.rows.length).toBe(3);
      });

      await act(async () => {
        await database.put({ _id: "d", foo: "dragonfruit" });
      });

      await waitFor(() => {
        expect(result.current.rows.length).toBe(4);
        const values = result.current.docs.map((d: Record<string, unknown>) => d.foo);
        expect(values).toContain("dragonfruit");
      });
    },
    TEST_TIMEOUT
  );
});

// ── useAllDocs ──────────────────────────────────────────────────────

describe("HOOK: useAllDocs", () => {
  let dbName: string;
  let database: FireflyDatabase;
  let useAllDocs: ReturnType<typeof useFireproof>["useAllDocs"];

  beforeAll(async () => {
    dbName = uniqueDbName();
    const { result } = renderHook(() => useFireproof(dbName));
    database = result.current.database;
    useAllDocs = result.current.useAllDocs;

    await database.put({ _id: "x1", fruit: "apple" });
    await database.put({ _id: "x2", fruit: "banana" });
    await database.put({ _id: "x3", fruit: "cherry" });
  });

  it(
    "fetches all documents",
    async () => {
      const { result } = renderHook(() => useAllDocs());

      await waitFor(() => {
        // All tests share one mockApi, so docs accumulate. Check we have at least our 3.
        expect(result.current.docs.length).toBeGreaterThanOrEqual(3);
      });
    },
    TEST_TIMEOUT
  );

  it(
    "updates when database changes",
    async () => {
      const { result } = renderHook(() => useAllDocs());

      await waitFor(() => {
        expect(result.current.docs.length).toBeGreaterThanOrEqual(3);
      });

      await act(async () => {
        await database.put({ _id: "x4", fruit: "dragonfruit" });
      });

      await waitFor(() => {
        expect(result.current.docs.length).toBeGreaterThanOrEqual(4);
      });
    },
    TEST_TIMEOUT
  );

  it(
    "handles subscription lifecycle (mount/unmount)",
    async () => {
      const { result, unmount } = renderHook(() => useAllDocs());

      await waitFor(() => {
        expect(result.current.docs.length).toBeGreaterThanOrEqual(3);
      });

      // Unmount should not throw
      unmount();
    },
    TEST_TIMEOUT
  );
});

// ── useChanges ──────────────────────────────────────────────────────

describe("HOOK: useChanges", () => {
  it(
    "returns empty result (Firefly stub)",
    async () => {
      const dbName = uniqueDbName();
      const { result: fpResult } = renderHook(() => useFireproof(dbName));
      const useChanges = fpResult.current.useChanges;

      const { result } = renderHook(() => useChanges());

      await waitFor(() => {
        expect(result.current.rows).toEqual([]);
        expect(result.current.docs).toEqual([]);
      });
    },
    TEST_TIMEOUT
  );
});

// ── viewer-ready re-fetch (#2285) ───────────────────────────────────

describe("HOOK: useLiveQuery viewer-ready re-fetch (#2285)", () => {
  it(
    "re-issues the backend query when the viewer resolves, with no local write",
    async () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider mountParams={{ usrEnv: {} }}>{children}</VibeContextProvider>
      );

      renderHook(
        () => {
          const { useLiveQuery } = useFireproof(dbName);
          return useLiveQuery("foo");
        },
        { wrapper }
      );

      // Mount fires the first backend query while the viewer is unresolved.
      await waitFor(() => {
        expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0);
      });
      const callsBeforeViewer = mockApi._queryDocsFilterHints.length;

      // Drive the real signal VibeContext listens to: a window "message"
      // event carrying vibe.evt.viewerChanged → setViewerEnv → viewer resolves.
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { type: "vibe.evt.viewerChanged", viewer: { userHandle: "anna" }, access: "viewer" },
          })
        );
      });

      // The fix: viewer-ready re-fires the query with no local write.
      await waitFor(() => {
        expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(callsBeforeViewer);
      });
    },
    TEST_TIMEOUT
  );

  it(
    "useAllDocs re-issues the query when the viewer resolves",
    async () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider mountParams={{ usrEnv: {} }}>{children}</VibeContextProvider>
      );
      renderHook(
        () => {
          const { useAllDocs } = useFireproof(dbName);
          return useAllDocs();
        },
        { wrapper }
      );
      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0));
      const before = mockApi._queryDocsFilterHints.length;
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { type: "vibe.evt.viewerChanged", viewer: { userHandle: "anna" }, access: "viewer" },
          })
        );
      });
      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(before));
    },
    TEST_TIMEOUT
  );

  it(
    "useDocument re-fetches an existing doc when the viewer resolves",
    async () => {
      const dbName = uniqueDbName();
      const { result: fpResult } = renderHook(() => useFireproof(dbName));
      const { id } = await fpResult.current.database.put({ input: "existing" });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider mountParams={{ usrEnv: {} }}>{children}</VibeContextProvider>
      );
      let getCalls = 0;
      const realGet = fpResult.current.database.get.bind(fpResult.current.database);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fpResult.current.database as any).get = async (docId: string) => {
        getCalls++;
        return realGet(docId);
      };

      renderHook(
        () => {
          const { useDocument } = fpResult.current;
          return useDocument({ _id: id });
        },
        { wrapper }
      );
      await waitFor(() => expect(getCalls).toBeGreaterThan(0));
      const before = getCalls;
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { type: "vibe.evt.viewerChanged", viewer: { userHandle: "anna" }, access: "viewer" },
          })
        );
      });
      await waitFor(() => expect(getCalls).toBeGreaterThan(before));
    },
    TEST_TIMEOUT
  );

  it(
    "no-access-fn app (no grants) still re-fetches on viewer-ready and is otherwise unchanged",
    async () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider mountParams={{ usrEnv: {} }}>{children}</VibeContextProvider>
      );
      const { result } = renderHook(
        () => {
          const fp = useFireproof(dbName);
          return { live: fp.useLiveQuery("foo"), access: fp.access };
        },
        { wrapper }
      );
      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0));
      expect(result.current.access.channels.size).toBe(0);
      const before = mockApi._queryDocsFilterHints.length;
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { type: "vibe.evt.viewerChanged", viewer: { userHandle: "solo" }, access: "viewer" },
          })
        );
      });
      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(before));
    },
    TEST_TIMEOUT
  );

  it(
    "does not re-query on an unrelated re-render (no viewer change)",
    async () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider mountParams={{ usrEnv: {} }}>{children}</VibeContextProvider>
      );
      const { rerender } = renderHook(
        () => {
          const { useLiveQuery } = useFireproof(dbName);
          return useLiveQuery("foo");
        },
        { wrapper }
      );
      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0));
      const before = mockApi._queryDocsFilterHints.length;
      rerender();
      rerender();
      await new Promise((r) => setTimeout(r, 50));
      expect(mockApi._queryDocsFilterHints.length).toBe(before);
    },
    TEST_TIMEOUT
  );

  it(
    "useChanges re-fires when the viewer resolves",
    async () => {
      const dbName = uniqueDbName();
      const { result: fpResult } = renderHook(() => useFireproof(dbName));
      // useChanges() is a stub that calls database.changes() (not queryDocs),
      // so count changes() calls directly to detect the re-fire.
      let changesCalls = 0;
      const realChanges = fpResult.current.database.changes.bind(fpResult.current.database);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fpResult.current.database as any).changes = async () => {
        changesCalls++;
        return realChanges();
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider mountParams={{ usrEnv: {} }}>{children}</VibeContextProvider>
      );
      renderHook(
        () => {
          const { useChanges } = fpResult.current;
          return useChanges();
        },
        { wrapper }
      );
      await waitFor(() => expect(changesCalls).toBeGreaterThan(0));
      const before = changesCalls;
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { type: "vibe.evt.viewerChanged", viewer: { userHandle: "anna" }, access: "viewer" },
          })
        );
      });
      await waitFor(() => expect(changesCalls).toBeGreaterThan(before));
    },
    TEST_TIMEOUT
  );
});

// ── grant-change re-query + re-subscribe (live doc updates) ─────────

describe("HOOK: useLiveQuery re-queries on a grants-only change", () => {
  function viewerChanged(dbName: string, channels: string[]) {
    return new MessageEvent("message", {
      data: {
        type: "vibe.evt.viewerChanged",
        viewer: { userHandle: "anna" },
        access: "viewer",
        grants: { [dbName]: { channels, publicChannels: [], roles: [] } },
      },
    });
  }

  it(
    "re-fires the query when a new grant adds a channel (same user, same access)",
    async () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider
          mountParams={{
            usrEnv: {},
            viewerEnv: {
              viewer: { userHandle: "anna" },
              access: "viewer",
              grants: { [dbName]: { channels: [], publicChannels: [], roles: [] } },
            },
          }}
        >
          {children}
        </VibeContextProvider>
      );

      renderHook(
        () => {
          const { useLiveQuery } = useFireproof(dbName);
          return useLiveQuery("foo");
        },
        { wrapper }
      );

      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0));
      const before = mockApi._queryDocsFilterHints.length;

      act(() => {
        window.dispatchEvent(viewerChanged(dbName, ["c1"]));
      });

      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(before));
    },
    TEST_TIMEOUT
  );

  it(
    "does NOT re-fire when the grant arrays only reorder (sorted signature)",
    async () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider
          mountParams={{
            usrEnv: {},
            viewerEnv: {
              viewer: { userHandle: "anna" },
              access: "viewer",
              grants: { [dbName]: { channels: ["a", "b"], publicChannels: [], roles: [] } },
            },
          }}
        >
          {children}
        </VibeContextProvider>
      );

      renderHook(
        () => {
          const { useLiveQuery } = useFireproof(dbName);
          return useLiveQuery("foo");
        },
        { wrapper }
      );

      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0));
      const before = mockApi._queryDocsFilterHints.length;

      act(() => {
        window.dispatchEvent(viewerChanged(dbName, ["b", "a"]));
      });

      // Give any spurious effect a chance to fire, then assert none did.
      await new Promise((r) => setTimeout(r, 50));
      expect(mockApi._queryDocsFilterHints.length).toBe(before);
    },
    TEST_TIMEOUT
  );

  it(
    "re-issues subscribeDocs for the db when a new grant arrives",
    async () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider
          mountParams={{
            usrEnv: {},
            viewerEnv: {
              viewer: { userHandle: "anna" },
              access: "viewer",
              grants: { [dbName]: { channels: [], publicChannels: [], roles: [] } },
            },
          }}
        >
          {children}
        </VibeContextProvider>
      );

      renderHook(
        () => {
          const { useLiveQuery } = useFireproof(dbName);
          return useLiveQuery("foo");
        },
        { wrapper }
      );

      // Constructor subscribes once on mount.
      await waitFor(() => expect(mockApi._subscribeDocsCalls.filter((n) => n === dbName).length).toBe(1));

      act(() => {
        window.dispatchEvent(viewerChanged(dbName, ["c1"]));
      });

      // Fix: the grant change re-issues subscribeDocs for this db.
      await waitFor(() => expect(mockApi._subscribeDocsCalls.filter((n) => n === dbName).length).toBeGreaterThan(1));
    },
    TEST_TIMEOUT
  );

  // The signature covers all three grant arrays — guard publicChannels/roles,
  // not just channels.
  function grantsEvt(dbName: string, grants: { channels?: string[]; publicChannels?: string[]; roles?: string[] }) {
    return new MessageEvent("message", {
      data: {
        type: "vibe.evt.viewerChanged",
        viewer: { userHandle: "anna" },
        access: "viewer",
        grants: {
          [dbName]: { channels: grants.channels ?? [], publicChannels: grants.publicChannels ?? [], roles: grants.roles ?? [] },
        },
      },
    });
  }

  it(
    "re-fires when only publicChannels or only roles change (channels constant)",
    async () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider
          mountParams={{
            usrEnv: {},
            viewerEnv: {
              viewer: { userHandle: "anna" },
              access: "viewer",
              grants: { [dbName]: { channels: ["x"], publicChannels: [], roles: [] } },
            },
          }}
        >
          {children}
        </VibeContextProvider>
      );

      renderHook(
        () => {
          const { useLiveQuery } = useFireproof(dbName);
          return useLiveQuery("foo");
        },
        { wrapper }
      );

      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0));

      // publicChannels [] -> ["p1"], channels unchanged.
      const beforePub = mockApi._queryDocsFilterHints.length;
      act(() => {
        window.dispatchEvent(grantsEvt(dbName, { channels: ["x"], publicChannels: ["p1"] }));
      });
      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(beforePub));

      // roles [] -> ["r1"], channels + publicChannels unchanged.
      const beforeRoles = mockApi._queryDocsFilterHints.length;
      act(() => {
        window.dispatchEvent(grantsEvt(dbName, { channels: ["x"], publicChannels: ["p1"], roles: ["r1"] }));
      });
      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(beforeRoles));
    },
    TEST_TIMEOUT
  );

  it(
    "useAllDocs re-queries on a grants-only change",
    async () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider
          mountParams={{
            usrEnv: {},
            viewerEnv: {
              viewer: { userHandle: "anna" },
              access: "viewer",
              grants: { [dbName]: { channels: [], publicChannels: [], roles: [] } },
            },
          }}
        >
          {children}
        </VibeContextProvider>
      );

      renderHook(
        () => {
          const { useAllDocs } = useFireproof(dbName);
          return useAllDocs();
        },
        { wrapper }
      );

      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0));
      const before = mockApi._queryDocsFilterHints.length;
      act(() => {
        window.dispatchEvent(viewerChanged(dbName, ["c1"]));
      });
      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(before));
    },
    TEST_TIMEOUT
  );

  it(
    "useChanges re-fires on a grants-only change",
    async () => {
      const dbName = uniqueDbName();
      const { result: fpResult } = renderHook(() => useFireproof(dbName));
      let changesCalls = 0;
      const realChanges = fpResult.current.database.changes.bind(fpResult.current.database);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fpResult.current.database as any).changes = async () => {
        changesCalls++;
        return realChanges();
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider
          mountParams={{
            usrEnv: {},
            viewerEnv: {
              viewer: { userHandle: "anna" },
              access: "viewer",
              grants: { [dbName]: { channels: [], publicChannels: [], roles: [] } },
            },
          }}
        >
          {children}
        </VibeContextProvider>
      );
      renderHook(
        () => {
          const { useChanges } = fpResult.current;
          return useChanges();
        },
        { wrapper }
      );

      await waitFor(() => expect(changesCalls).toBeGreaterThan(0));
      const before = changesCalls;
      act(() => {
        window.dispatchEvent(viewerChanged(dbName, ["c1"]));
      });
      await waitFor(() => expect(changesCalls).toBeGreaterThan(before));
    },
    TEST_TIMEOUT
  );

  it(
    "useDocument re-fetches on a grants-only change",
    async () => {
      const dbName = uniqueDbName();
      const { result: fpResult } = renderHook(() => useFireproof(dbName));
      const { id } = await fpResult.current.database.put({ input: "existing" });

      let getCalls = 0;
      const realGet = fpResult.current.database.get.bind(fpResult.current.database);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fpResult.current.database as any).get = async (docId: string) => {
        getCalls++;
        return realGet(docId);
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider
          mountParams={{
            usrEnv: {},
            viewerEnv: {
              viewer: { userHandle: "anna" },
              access: "viewer",
              grants: { [dbName]: { channels: [], publicChannels: [], roles: [] } },
            },
          }}
        >
          {children}
        </VibeContextProvider>
      );
      renderHook(
        () => {
          const { useDocument } = fpResult.current;
          return useDocument({ _id: id });
        },
        { wrapper }
      );

      await waitFor(() => expect(getCalls).toBeGreaterThan(0));
      const before = getCalls;
      act(() => {
        window.dispatchEvent(viewerChanged(dbName, ["c1"]));
      });
      await waitFor(() => expect(getCalls).toBeGreaterThan(before));
    },
    TEST_TIMEOUT
  );
});

// ── access (roles + channels from grants) ──────────────────────────

describe("HOOK: useFireproof access", () => {
  it(
    "returns empty access when no grants are present",
    () => {
      const dbName = uniqueDbName();
      const { result } = renderHook(() => useFireproof(dbName));
      const { access } = result.current;

      expect(access.roles.size).toBe(0);
      expect(access.channels.size).toBe(0);
      expect(access.hasRole("moderator")).toBe(false);
      expect(access.hasChannel("general")).toBe(false);
    },
    TEST_TIMEOUT
  );

  it(
    "exposes grants for the matching database",
    () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider
          mountParams={{
            usrEnv: {},
            viewerEnv: {
              viewer: { userHandle: "alice" },
              access: "editor",
              grants: {
                [dbName]: { roles: ["moderator", "poster"], channels: ["general", "announcements"], publicChannels: [] },
              },
            },
          }}
        >
          {children}
        </VibeContextProvider>
      );

      const { result } = renderHook(() => useFireproof(dbName), { wrapper });
      const { access } = result.current;

      expect(access.hasRole("moderator")).toBe(true);
      expect(access.hasRole("poster")).toBe(true);
      expect(access.hasRole("admin")).toBe(false);

      expect(access.hasChannel("general")).toBe(true);
      expect(access.hasChannel("announcements")).toBe(true);
      expect(access.hasChannel("secret")).toBe(false);

      expect([...access.roles]).toEqual(expect.arrayContaining(["moderator", "poster"]));
      expect([...access.channels]).toEqual(expect.arrayContaining(["general", "announcements"]));
    },
    TEST_TIMEOUT
  );

  it(
    "returns empty access for databases without grants",
    () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider
          mountParams={{
            usrEnv: {},
            viewerEnv: {
              viewer: { userHandle: "alice" },
              access: "editor",
              grants: {
                "other-db": { roles: ["admin"], channels: ["private"], publicChannels: [] },
              },
            },
          }}
        >
          {children}
        </VibeContextProvider>
      );

      const { result } = renderHook(() => useFireproof(dbName), { wrapper });
      const { access } = result.current;

      expect(access.roles.size).toBe(0);
      expect(access.channels.size).toBe(0);
      expect(access.hasRole("admin")).toBe(false);
      expect(access.hasChannel("private")).toBe(false);
    },
    TEST_TIMEOUT
  );
});
