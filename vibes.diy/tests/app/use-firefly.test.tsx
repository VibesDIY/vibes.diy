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
              viewer: { userHandle: "alice", avatarUrl: "https://api.test/u/alice/avatar" },
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
              viewer: { userHandle: "alice", avatarUrl: "https://api.test/u/alice/avatar" },
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
