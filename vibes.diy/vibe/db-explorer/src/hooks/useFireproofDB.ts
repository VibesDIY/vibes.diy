import { useCallback, useMemo, useRef } from "react";
import { useFireproof, type DocWithId } from "@vibes.diy/vibe-runtime";

interface UseFireproofDBResult {
  docs: DocWithId[];
  docById: Map<string, DocWithId>;
  loading: boolean;
  totalDocs: number;
  putDoc: (doc: Record<string, unknown>) => Promise<void>;
  deleteDoc: (id: string) => Promise<void>;
  createDoc: (doc: Record<string, unknown>) => Promise<string>;
  seedData: () => Promise<void>;
}

export function useFireproofDB(dbName: string): UseFireproofDBResult {
  const { database, useLiveQuery } = useFireproof(dbName);
  const { docs: allDocs } = useLiveQuery("_id");
  const loading = false;

  const dbRef = useRef(database);
  dbRef.current = database;

  const totalDocs = allDocs.length;

  const docById = useMemo(() => {
    const map = new Map<string, DocWithId>();
    for (const d of allDocs) {
      if (d._id) map.set(d._id, d);
    }
    return map;
  }, [allDocs]);

  const putDoc = useCallback(async (doc: Record<string, unknown>) => {
    await dbRef.current.put(doc);
  }, []);

  const deleteDoc = useCallback(async (id: string) => {
    await dbRef.current.del(id);
  }, []);

  const createDoc = useCallback(async (doc: Record<string, unknown>): Promise<string> => {
    const res = await dbRef.current.put(doc);
    return res.id;
  }, []);

  const seedData = useCallback(async () => {
    const db = dbRef.current;
    const tags = ["urgent", "review", "blocked", "shipped", "wip"];
    const names = ["Alice", "Bob", "Charlie", "Dana", "Eve", "Frank", "Grace", "Hank"];
    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
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
      });
    }
  }, []);

  return {
    docs: allDocs,
    docById,
    loading,
    totalDocs,
    putDoc,
    deleteDoc,
    createDoc,
    seedData,
  };
}
