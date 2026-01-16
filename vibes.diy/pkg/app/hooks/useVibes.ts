import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import type { LocalVibe } from "../utils/vibeUtils.js";
import {
  deleteVibeDatabase,
  listLocalVibeIds,
  toggleVibeFavorite,
} from "../utils/vibeUtils.js";

/**
 * Custom hook for managing vibes state
 * Handles loading, deleting, and maintaining the state of vibes
 */
export function useVibes() {
  const [vibes, setVibes] = useState<LocalVibe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Get the current user ID from Clerk
  const { user } = useUser();
  const userId = user?.id;

  // Function to load vibes
  const loadVibes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const vibeIds = await listLocalVibeIds();
      setVibes(vibeIds.map((id) => ({ id })).reverse() as LocalVibe[]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to delete a vibe with optimistic UI update
  const deleteVibe = useCallback(
    async (vibeId: string) => {
      try {
        // Optimistically update UI by removing the vibe from state
        setVibes((currentVibes) =>
          currentVibes.filter((vibe) => vibe.id !== vibeId),
        );

        // Actually delete the vibe database
        await deleteVibeDatabase(vibeId);

        // We don't need to reload vibes since we've already updated the state optimistically
        // But if you want to ensure DB and state are in sync, you could uncomment this:
        // await loadVibes();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));

        // If deletion fails, reload vibes to restore correct state
        await loadVibes();
      }
    },
    [loadVibes],
  );

  // Load vibes on mount
  useEffect(() => {
    loadVibes();
  }, [loadVibes]);

  // Function to toggle favorite status on a vibe
  const toggleFavorite = useCallback(
    async (vibeId: string) => {
      try {
        // Optimistically update UI by updating the favorite status in state
        setVibes((currentVibes) =>
          currentVibes.map((vibe) =>
            vibe.id === vibeId ? { ...vibe, favorite: !vibe.favorite } : vibe,
          ),
        );

        // Update the favorite status in the database
        // Pass the userId to also update the user's vibe space database
        await toggleVibeFavorite(vibeId, userId);

        // We don't need to reload vibes since we've already updated the state optimistically
        // But if you want to ensure DB and state are in sync, you could uncomment this:
        // await loadVibes();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));

        // If toggling fails, reload vibes to restore correct state
        await loadVibes();
      }
    },
    [loadVibes, userId], // Add userId to dependencies array
  );

  return {
    vibes,
    isLoading,
    error,
    loadVibes,
    deleteVibe,
    toggleFavorite,
  };
}
