import { useFireproof } from 'use-fireproof';
import { useEffect, useMemo } from 'react';
import type { LocalVibe } from '../utils/vibeUtils';

// Module-level singleton flags for better sync protection
let syncInProgress = false;
let lastSyncedKey: string | null = null;

export function useSync(userId: string, vibes: Array<LocalVibe>) {
  if (!userId) throw new Error('No user ID provided');

  const dbName = `vibesync-${userId}`;
  const { database, useAllDocs } = useFireproof(dbName);

  // Get real-time count of synced vibes
  const allDocsResult = useAllDocs() as {
    docs: Array<{ _id: string }>;
    rows?: Array<{ id: string }>;
  };
  const count = allDocsResult?.rows?.length || 0;

  // Create a stable key based on vibe IDs to prevent unnecessary re-syncing
  const vibeKey = useMemo(() => {
    return vibes
      .map((v) => v.id)
      .sort()
      .join(',');
  }, [vibes]);

  useEffect(() => {
    if (!vibes || vibes.length === 0) return;

    // Prevent double syncing with module-level singleton behavior
    if (syncInProgress || lastSyncedKey === vibeKey) {
      console.log(
        '🚫 DISCARDED sync call - already in progress or already synced this key:',
        vibeKey,
        {
          syncInProgress,
          lastSyncedKey,
          currentKey: vibeKey,
        }
      );
      return;
    }

    console.log('✅ STARTING sync for', vibes.length, 'vibes, key:', vibeKey);
    syncInProgress = true;

    const sync = async () => {
      // Wait 2000ms to allow database to be fully initialized after page load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log('Starting sync for database:', dbName);
      console.log('Database object:', database);

      // First, get all already synced vibe IDs using fireproof 0.23.0 API
      const allDocsResult = await database.allDocs({ includeDocs: true });
      console.log('allDocs length BEFORE sync:', allDocsResult.rows.length);

      const syncedVibeIds = new Set(
        allDocsResult.rows
          .map((row) => row.key)
          .filter((key) => key.startsWith('sync-'))
          .map((key) => key.replace('sync-', ''))
      );

      console.log('already synced vibe IDs:', Array.from(syncedVibeIds));

      // Filter to only sync unsynced vibes
      const unsyncedVibes = vibes.filter((vibe) => !syncedVibeIds.has(vibe.id));
      console.log('unsynced vibes to sync:', unsyncedVibes.length, 'out of', vibes.length);

      // Prepare documents for bulk insert
      const docsToSync = unsyncedVibes.map((vibe) => ({
        _id: `sync-${vibe.id}`,
        created: Date.now(),
        userId,
        vibeId: vibe.id,
        title: vibe.title,
        url: vibe.publishedUrl,
      }));

      // Bulk sync all unsynced vibes at once
      if (docsToSync.length > 0) {
        console.log('✅ bulk syncing', docsToSync.length, 'new vibes');
        await database.bulk(docsToSync);
        console.log('✅ synced', docsToSync.length, 'new vibes');

        // Log final state using fireproof 0.23.0 API
        const finalResult = await database.allDocs({ includeDocs: true });
        console.log('✅ total synced vibes:', finalResult.rows.length);
        console.log('final doc keys:', finalResult.rows.map((row) => row.key).join(', '));
      }

      // Mark this key as synced and reset in-progress flag
      lastSyncedKey = vibeKey;
      syncInProgress = false;
      console.log('✅ COMPLETED sync for key:', vibeKey);
    };

    sync().catch((error) => {
      console.error('❌ Sync failed:', error);
      // Reset flags on error
      syncInProgress = false;
    });
  }, [userId, vibeKey, database]); // Use vibeKey instead of vibes array

  return { count };
}
