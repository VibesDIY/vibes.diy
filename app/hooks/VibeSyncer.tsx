import { useSync } from './useSync';
import type { LocalVibe } from '~/utils/vibeUtils';

/**
 * Implementation component that contains all the hooks and logic.
 * This is only rendered when userId and vibes are available.
 */
function VibeSyncerImpl({ userId, vibes }: { userId: string; vibes: Array<LocalVibe> }) {
  const { count } = useSync(userId, vibes);

  return (
    <span style={{ display: 'inline-block', marginBottom: 8, fontWeight: 500 }}>
      {count !== null ? `Syncing ${count} vibes` : '...'}
    </span>
  );
}

/**
 * Public wrapper component that handles conditional rendering.
 * Users can include this without checking for userId themselves.
 */
export function VibeSyncer({ userId, vibes }: { userId?: string; vibes?: Array<LocalVibe> }) {
  if (!userId || !vibes) return null;
  return <VibeSyncerImpl userId={userId} vibes={vibes} />;
}
