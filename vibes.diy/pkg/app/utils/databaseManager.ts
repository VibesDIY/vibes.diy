import { DocResponse, fireproof } from "@fireproof/use-fireproof";

/**
 * Get the database name for a session
 * @param sessionId The session ID to get the database name for
 * @returns The database name for the session
 */
export const getSessionDatabaseName = (sessionId: string) => {
  if (!sessionId) throw new Error("Session ID is required");
  return `vibe-${sessionId}`;
};

/**
 * Update a document in the user's vibespace database
 * @param userId The user ID who owns the vibespace
 * @param slug The slug or identifier for the document
 * @param data Additional data to include in the document
 * @returns Promise resolving to the updated document
 */
export async function updateUserVibespaceDoc(
  userId: string,
  slug: string,
  data: Record<string, unknown>,
): Promise<DocResponse> {
  if (!userId || !slug) {
    throw new Error("userId and slug are required for updating vibespace");
  }

  // Get the user's vibespace database
  const userVibespaceDb = fireproof(`vu-${userId}`);

  // Use a consistent document ID format
  const docId = `app-${slug}`;

  // Try to get existing document or create a new one
  const existingDoc = await userVibespaceDb.get(docId).catch(() => ({
    _id: docId,
  }));

  // Merge existing data with new data
  const updatedDoc = {
    ...existingDoc,
    ...data,
    lastUpdated: Date.now(),
  };

  // Update the document
  const result = await userVibespaceDb.put(updatedDoc);
  return result;
}
