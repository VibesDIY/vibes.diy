/**
 * Firefly wrapper for useFireproof.
 *
 * Exports a `useFireproof` that creates FireflyDatabase instances (API-backed)
 * and wraps them with the real use-fireproof React hooks.
 *
 * Apps import from "use-vibes" which aliases to @vibes.diy/vibe-runtime.
 * This module is re-exported from vibe-runtime/index.ts.
 */

import { useMemo } from "react";
import { FireflyDatabase } from "./firefly-database.js";
import type { VibeSandboxApi } from "./register-dependencies.js";

// Module-scoped state, set by registerFirefly()
let vibeApiRef: VibeSandboxApi | undefined;

// Cache FireflyDatabase instances by name so useMemo stability works
const dbCache = new Map<string, FireflyDatabase>();

function getOrCreateDb(name: string): FireflyDatabase {
  let db = dbCache.get(name);
  if (!db) {
    if (!vibeApiRef) {
      throw new Error("Firefly not initialized — registerFirefly() must be called before useFireproof()");
    }
    db = new FireflyDatabase(name, vibeApiRef);
    dbCache.set(name, db);
  }
  return db;
}

// Dynamically loaded hook factories from the real use-fireproof package
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let createUseDocumentFn: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let createUseLiveQueryFn: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let createUseAllDocsFn: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let createUseChangesFn: any;

/**
 * Register the Firefly system. Called by registerDependencies().
 * Loads the real use-fireproof hook factories for wrapping FireflyDatabase.
 */
export async function registerFirefly(api: VibeSandboxApi, useFireproofModuleUrl: string): Promise<void> {
  vibeApiRef = api;

  // Import the real use-fireproof to get its React hook factories
  const mod = await import(useFireproofModuleUrl);
  createUseDocumentFn = mod.createUseDocument;
  createUseLiveQueryFn = mod.createUseLiveQuery;
  createUseAllDocsFn = mod.createUseAllDocs;
  createUseChangesFn = mod.createUseChanges;

  // Subscribe to docs for cross-client sync
  api.subscribeDocs().then((rRes) => {
    if (rRes.isErr()) {
      console.error("Failed to subscribe to docs:", rRes.Err());
    }
  });
}

/**
 * Drop-in replacement for useFireproof that uses FireflyDatabase.
 * Apps call: const { database, useLiveQuery, useDocument } = useFireproof("mydb")
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFireproof(name = "useFireproof", _config: any = {}) {
  const database = useMemo(() => getOrCreateDb(name), [name]);

  const useDocument = useMemo(
    () => (createUseDocumentFn ? createUseDocumentFn(database) : throwNotReady("useDocument")),
    [database]
  );

  const useLiveQuery = useMemo(
    () => (createUseLiveQueryFn ? createUseLiveQueryFn(database) : throwNotReady("useLiveQuery")),
    [database]
  );

  const useAllDocs = useMemo(() => (createUseAllDocsFn ? createUseAllDocsFn(database) : throwNotReady("useAllDocs")), [database]);

  const useChanges = useMemo(() => (createUseChangesFn ? createUseChangesFn(database) : throwNotReady("useChanges")), [database]);

  // attach is a no-op for Firefly (no cloud gateway needed)
  const attach = () => Promise.resolve();

  return { database, useLiveQuery, useDocument, useAllDocs, useChanges, attach };
}

function throwNotReady(hookName: string) {
  return () => {
    throw new Error(`Firefly: ${hookName} not ready — registerFirefly() has not completed`);
  };
}
