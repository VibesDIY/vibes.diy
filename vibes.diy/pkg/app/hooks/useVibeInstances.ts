import { useCallback, useState } from "react";
import { useFireproof } from "use-vibes";
import { useAuth } from "../contexts/AuthContext.js";
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
  const { database, useLiveQuery } = useFireproof("vibes-diy-instances");
  const { userPayload } = useAuth();
  const userId = userPayload?.userId || "anonymous";

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Query instances for this titleId
  const instancesResult = useLiveQuery<VibeInstanceDocument>(
    (doc) =>
      doc.titleId === titleId &&
      (doc.userId === userId || doc.sharedWith?.includes(userId)),
  );

  const instances = instancesResult.docs || [];

  /**
   * Create a new instance
   * Generates a custom _id in format: ${titleId}-${installId}
   */
  const createInstance = useCallback(
    async (description: string, options?: Record<string, unknown>) => {
      try {
        setIsCreating(true);
        setError(null);

        // Generate custom _id: titleId-installId
        const installId = generateInstallId();
        const customId = `${titleId}-${installId}`;

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

        return result.id; // Return the custom ID
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsCreating(false);
      }
    },
    [database, titleId, userId],
  );

  /**
   * Update an instance's description or options
   */
  const updateInstance = useCallback(
    async (
      uuid: string,
      updates: { description?: string; options?: Record<string, unknown> },
    ) => {
      try {
        setError(null);

        // Get existing document
        const existing = await database.get<VibeInstanceDocument>(uuid);

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
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [database, titleId, userId],
  );

  /**
   * Delete an instance
   */
  const deleteInstance = useCallback(
    async (uuid: string) => {
      try {
        setError(null);

        // Get existing document to verify ownership
        const existing = await database.get<VibeInstanceDocument>(uuid);

        // Ensure this instance belongs to the current vibe
        if (existing.titleId !== titleId) {
          throw new Error("This instance does not belong to the current vibe");
        }

        if (existing.userId !== userId) {
          throw new Error("You do not have permission to delete this instance");
        }

        // Delete from Fireproof
        await database.del(uuid);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [database, titleId, userId],
  );

  /**
   * Share an instance with another user
   */
  const shareInstance = useCallback(
    async (uuid: string, email: string) => {
      try {
        setError(null);

        // Get existing document
        const existing = await database.get<VibeInstanceDocument>(uuid);

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
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
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
