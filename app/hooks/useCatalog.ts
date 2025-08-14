import { useFireproof } from 'use-fireproof';
import { useEffect, useMemo } from 'react';
import type { LocalVibe } from '../utils/vibeUtils';

// Module-level singleton flags for better catalog protection
let catalogInProgress = false;
let lastCatalogedKey: string | null = null;

export function useCatalog(userId: string, vibes: Array<LocalVibe>) {
  if (!userId) throw new Error('No user ID provided');

  const dbName = `vibe-catalog-${userId}`;
  const { database, useAllDocs } = useFireproof(dbName);

  // Get real-time count of cataloged vibes
  const allDocsResult = useAllDocs() as {
    docs: Array<{ _id: string }>;
    rows?: Array<{ id: string }>;
  };
  const count = allDocsResult?.rows?.length || 0;

  // Create a stable key based on vibe IDs to prevent unnecessary re-cataloging
  const vibeKey = useMemo(() => {
    return vibes
      .map((v) => v.id)
      .sort()
      .join(',');
  }, [vibes]);

  useEffect(() => {
    if (!vibes || vibes.length === 0) return;

    // Prevent double cataloging with module-level singleton behavior
    if (catalogInProgress || lastCatalogedKey === vibeKey) {
      console.log(
        '🚫 DISCARDED catalog call - already in progress or already cataloged this key:',
        vibeKey,
        {
          catalogInProgress,
          lastCatalogedKey,
          currentKey: vibeKey,
        }
      );
      return;
    }

    console.log('✅ STARTING catalog for', vibes.length, 'vibes, key:', vibeKey);
    catalogInProgress = true;

    const catalog = async () => {
      // Wait 2000ms to allow database to be fully initialized after page load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log('Starting catalog for database:', dbName);
      console.log('Database object:', database);

      // First, get all already cataloged vibe IDs using fireproof 0.23.0 API
      const allDocsResult = await database.allDocs({ includeDocs: true });
      console.log('allDocs length BEFORE catalog:', allDocsResult.rows.length);

      const catalogedVibeIds = new Set(
        allDocsResult.rows
          .map((row) => row.key)
          .filter((key) => key.startsWith('catalog-'))
          .map((key) => key.replace('catalog-', ''))
      );

      console.log('already cataloged vibe IDs:', Array.from(catalogedVibeIds));

      // Filter to only catalog uncataloged vibes
      const uncatalogedVibes = vibes.filter((vibe) => !catalogedVibeIds.has(vibe.id));
      console.log('uncataloged vibes to catalog:', uncatalogedVibes.length, 'out of', vibes.length);

      // Prepare documents for bulk insert
      const docsToCatalog = uncatalogedVibes.map((vibe) => ({
        _id: `catalog-${vibe.id}`,
        created: Date.now(),
        userId,
        vibeId: vibe.id,
        title: vibe.title,
        url: vibe.publishedUrl,
      }));

      // Bulk catalog all uncataloged vibes at once
      if (docsToCatalog.length > 0) {
        console.log('✅ bulk cataloging', docsToCatalog.length, 'new vibes');
        await database.bulk(docsToCatalog);
        console.log('✅ cataloged', docsToCatalog.length, 'new vibes');

        // Log final state using fireproof 0.23.0 API
        const finalResult = await database.allDocs({ includeDocs: true });
        console.log('✅ total cataloged vibes:', finalResult.rows.length);
        console.log('final doc keys:', finalResult.rows.map((row) => row.key).join(', '));
      }

      // Mark this key as cataloged and reset in-progress flag
      lastCatalogedKey = vibeKey;
      catalogInProgress = false;
      console.log('✅ COMPLETED catalog for key:', vibeKey);
    };

    catalog().catch((error) => {
      console.error('❌ Catalog failed:', error);
      // Reset flags on error
      catalogInProgress = false;
    });
  }, [userId, vibeKey, database]); // Use vibeKey instead of vibes array

  return { count };
}
