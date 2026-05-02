import { useState, useEffect } from "react";
import { listDbNames } from "@vibes.diy/vibe-runtime";

interface UseIndexedDBListResult {
  databases: string[];
  loading: boolean;
}

export function useIndexedDBList(): UseIndexedDBListResult {
  const [databases, setDatabases] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    listDbNames()
      .then((names) => {
        if (!cancelled) setDatabases(names.sort());
      })
      .catch(() => {
        // listDbNames failed (not owner, not initialized, etc.)
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { databases, loading };
}
