import { useState, useEffect } from "react";

interface UseIndexedDBListResult {
  databases: string[];
  loading: boolean;
}

export function useIndexedDBList(): UseIndexedDBListResult {
  const [databases, setDatabases] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function discover() {
      try {
        if (typeof indexedDB.databases !== "function") {
          setLoading(false);
          return;
        }
        const allDbs = await indexedDB.databases();
        if (cancelled) return;
        const filtered = allDbs
          .map((db) => db.name)
          .filter((name): name is string => typeof name === "string" && name.startsWith("fp.") && name !== "fp-keybag")
          .map((name) => name.slice(3)) // strip "fp." prefix
          .sort();
        setDatabases(filtered);
      } catch {
        // indexedDB.databases() not supported or failed
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    discover();
    return () => {
      cancelled = true;
    };
  }, []);

  return { databases, loading };
}
