import { useState, useCallback, useMemo, useRef } from "react";
import { useFireproof } from "@fireproof/use-fireproof";
import type { DocBase } from "@fireproof/use-fireproof";

interface UseFireproofDBResult {
  docs: DocBase[];
  loading: boolean;
  totalDocs: number;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  putDoc: (doc: Record<string, unknown>) => Promise<void>;
  deleteDoc: (id: string) => Promise<void>;
  createDoc: (doc: Record<string, unknown>) => Promise<string>;
  seedData: () => Promise<void>;
}

export function useFireproofDB(dbName: string): UseFireproofDBResult {
  const { database, useLiveQuery } = useFireproof(dbName);
  const { docs: allDocs, hydrated } = useLiveQuery("_id");
  const loading = !hydrated;

  const dbRef = useRef(database);
  dbRef.current = database;

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const totalDocs = allDocs.length;

  const docs = useMemo(() => {
    const start = page * pageSize;
    return allDocs.slice(start, start + pageSize);
  }, [allDocs, page, pageSize]);

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setPageSize(newSize);
      setPage(0);
    },
    []
  );

  const putDoc = useCallback(
    async (doc: Record<string, unknown>) => {
      await dbRef.current.put(doc as unknown as DocBase);
    },
    []
  );

  const deleteDoc = useCallback(
    async (id: string) => {
      await dbRef.current.del(id);
    },
    []
  );

  const createDoc = useCallback(
    async (doc: Record<string, unknown>): Promise<string> => {
      const res = await dbRef.current.put(doc as unknown as DocBase);
      return res.id;
    },
    []
  );

  const seedData = useCallback(async () => {
    const db = dbRef.current;
    const tags = ["urgent", "review", "blocked", "shipped", "wip"];
    const names = ["Alice", "Bob", "Charlie", "Dana", "Eve", "Frank", "Grace", "Hank"];
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    for (let i = 0; i < 100; i++) {
      await db.put({
        type: pick(["task", "note", "event", "contact"]),
        title: `Item ${i + 1} - ${pick(["Setup", "Review", "Deploy", "Fix", "Plan", "Design"])} ${pick(["API", "UI", "DB", "Auth", "Tests", "Docs"])}`,
        status: pick(["open", "closed", "in_progress", "archived"]),
        priority: rand(1, 5),
        assignee: {
          name: pick(names),
          email: `${pick(names).toLowerCase()}@example.com`,
          role: pick(["admin", "editor", "viewer"]),
        },
        tags: Array.from({ length: rand(1, 3) }, () => pick(tags)),
        metrics: {
          views: rand(0, 5000),
          score: Math.round(Math.random() * 100) / 10,
          history: Array.from({ length: rand(2, 5) }, () => ({
            date: new Date(Date.now() - rand(0, 90) * 86400000).toISOString().slice(0, 10),
            value: rand(1, 100),
          })),
        },
        config: {
          enabled: Math.random() > 0.3,
          retries: rand(0, 5),
          nested: {
            deep: { flag: Math.random() > 0.5, label: pick(["alpha", "beta", "gamma"]) },
          },
        },
        notes: rand(0, 1) ? `Some notes about item ${i + 1}` : null,
        createdAt: new Date(Date.now() - rand(0, 365) * 86400000).toISOString(),
      } as unknown as DocBase);
    }
  }, []);

  return {
    docs,
    loading,
    totalDocs,
    page,
    pageSize,
    setPage,
    setPageSize: handlePageSizeChange,
    putDoc,
    deleteDoc,
    createDoc,
    seedData,
  };
}
