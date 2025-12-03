import { useCallback, useState } from "react";
import { useFireproof } from "use-fireproof";
import { useUser } from "@clerk/clerk-react";
import type { VibeInstanceDocument } from "@vibes.diy/prompts";

/**
 * Generate a short random install ID (8 hex characters)
 */
function generateInstallId(): string {
  return Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}

/**
 * Custom hook for managing vibe instances
 * Handles CRUD operations for vibe instances using Fireproof + KV
 */
export function useVibeInstances(titleId: string) {
  const { database, useLiveQuery } = useFireproof("vibes-groups");
  const { user } = useUser();
  const userId = user?.id || "anonymous";

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Query instances for this titleId using index
  const instancesResult = useLiveQuery<VibeInstanceDocument>("titleId", {
    key: titleId,
  });

  const instances = instancesResult.docs || [];

  /**
   * Create a new instance
   * Generates a custom _id in format: ${titleId}-${installId}
   * @param description - Human-readable description of the instance
   * @param options - Optional configuration object
   * @param installId - Optional specific install ID (for lazy creation from URLs)
   */
  const createInstance = useCallback(
    async (
      description: string,
      options?: Record<string, unknown>,
      installId?: string,
    ) => {
      setIsCreating(true);
      setError(null);

      try {
        // Use provided installId or generate a new one
        const finalInstallId = installId || generateInstallId();
        const customId = `${titleId}-${finalInstallId}`;

        // Create document with custom _id
        const doc: VibeInstanceDocument = {
          _id: customId,
          titleId,
          description,
          userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sharedWith: [],
          options: options || {},
        };

        const result = await database.put(doc);
        setIsCreating(false);

        return result.id; // Return the custom ID
      } catch (err) {
        setIsCreating(false);
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [database, titleId, userId],
  );

  /**
   * Update an instance's description or options
   */
  const updateInstance = useCallback(
    async (
      installId: string,
      updates: { description?: string; options?: Record<string, unknown> },
    ) => {
      setError(null);

      // Get existing document
      const existing = await database.get<VibeInstanceDocument>(installId);

      // Verify ownership
      if (existing.userId !== userId) {
        throw new Error("You do not have permission to edit this instance");
      }

      // Ensure this instance belongs to the current vibe
      if (existing.titleId !== titleId) {
        throw new Error("This instance does not belong to the current vibe");
      }

      // Update document
      const updated: VibeInstanceDocument = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await database.put(updated);
    },
    [database, titleId, userId],
  );

  /**
   * Delete an instance
   */
  const deleteInstance = useCallback(
    async (installId: string) => {
      setError(null);

      // Get existing document to verify ownership
      const existing = await database.get<VibeInstanceDocument>(installId);

      // Ensure this instance belongs to the current vibe
      if (existing.titleId !== titleId) {
        throw new Error("This instance does not belong to the current vibe");
      }

      if (existing.userId !== userId) {
        throw new Error("You do not have permission to delete this instance");
      }

      // Delete from Fireproof
      await database.del(installId);
    },
    [database, titleId, userId],
  );

  /**
   * Share an instance with another user
   */
  const shareInstance = useCallback(
    async (installId: string, email: string) => {
      setError(null);

      // Get existing document
      const existing = await database.get<VibeInstanceDocument>(installId);

      // Ensure this instance belongs to the current vibe
      if (existing.titleId !== titleId) {
        throw new Error("This instance does not belong to the current vibe");
      }

      // Verify ownership
      if (existing.userId !== userId) {
        throw new Error("You do not have permission to share this instance");
      }

      // Add to sharedWith if not already there
      const sharedWith = existing.sharedWith || [];
      if (!sharedWith.includes(email)) {
        sharedWith.push(email);
      }

      // Update document
      const updated: VibeInstanceDocument = {
        ...existing,
        sharedWith,
        updatedAt: new Date().toISOString(),
      };

      await database.put(updated);

      // Also call Fireproof share API (TODO: implement)
      // This would use the share() function from useFireproof
    },
    [database, titleId, userId],
  );

  return {
    instances,
    isCreating,
    error,
    createInstance,
    updateInstance,
    deleteInstance,
    shareInstance,
  };
}
