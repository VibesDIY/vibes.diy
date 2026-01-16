import { DocFileMeta, fireproof } from "@fireproof/use-fireproof";
import { updateUserVibespaceDoc } from "./databaseManager.js";
import type { VibeDocument } from "@vibes.diy/prompts";
import { encodeTitle } from "../components/SessionSidebar/utils.js";

/**
 * Interface for vibe documents stored in the database
 */
export interface LocalVibe {
  id: string;
  title: string;
  encodedTitle: string;
  slug: string;
  created: string;
  favorite?: boolean;
  publishedUrl?: string;
  screenshot?: {
    file: () => Promise<File>;
    type: string;
  };
}

/**
 * Loads the screenshot for a specific vibe
 * @param vibeId The ID of the vibe to load the screenshot for
 * @returns Object containing the screenshot file function and type, or undefined if no screenshot
 */
export async function loadVibeScreenshot(
  vibeId: string,
): Promise<DocFileMeta | undefined> {
  try {
    // Open the Fireproof database for this vibe
    const db = fireproof("vibe-" + vibeId);

    // Query for the most recent screenshot document
    const result = await db.query("type", {
      key: "screenshot",
      includeDocs: true,
      descending: true,
      limit: 1,
    });

    if (result.rows.length > 0) {
      const screenshotDoc = result.rows[0].doc; // as any;

      // Get the screenshot file if available
      if (
        screenshotDoc &&
        screenshotDoc._files &&
        screenshotDoc._files.screenshot &&
        (screenshotDoc._files.screenshot as DocFileMeta).file
      ) {
        return screenshotDoc._files.screenshot as DocFileMeta;
      }
    }

    return undefined;
  } catch (error) {
    // Return undefined if there's any error in the process
    return undefined;
  }
}

/**
 * Scan IndexedDB for vibe databases and return just the IDs
 * @returns Array of vibe IDs as strings
 */
export async function listLocalVibeIds(): Promise<string[]> {
  try {
    // Get all available IndexedDB databases
    const databases = await indexedDB.databases();

    // Filter for databases that start with 'fp.vibe-' and extract IDs
    const vibeIds = databases
      .filter((db) => db.name && db.name.startsWith("fp.vibe-"))
      .map((db) => db.name?.replace("fp.vibe-", "") || "")
      .filter((id) => id !== "");

    return vibeIds;
  } catch (error) {
    // Return empty array if there's any error in the process
    return [];
  }
}

/**
 * Load a single vibe document by its ID
 * @param vibeId The ID of the vibe to load
 * @returns A LocalVibe object or null if not found/valid
 */
export async function loadVibeDocument(
  vibeId: string,
): Promise<LocalVibe | null> {
  try {
    // Open the Fireproof database for this vibe
    const db = fireproof("vibe-" + vibeId);

    // Get the vibe document
    const vibeDoc = (await db.get("vibe")) as VibeDocument;

    if (vibeDoc && vibeDoc._id === "vibe") {
      // Get creation timestamp from vibeDoc or fallback to current time
      // Convert timestamp to ISO string for consistent formatting
      const createdTimestamp: string = vibeDoc.created_at
        ? new Date(vibeDoc.created_at).toISOString()
        : new Date("2025-02-02T15:17:00Z").toISOString();

      const title = vibeDoc.title || "Unnamed Vibe";
      return {
        id: vibeId,
        title,
        encodedTitle: vibeDoc.encodedTitle || encodeTitle(title),
        slug: vibeDoc.remixOf || vibeId, // Use remixOf as the slug
        created: createdTimestamp,
        favorite: vibeDoc.favorite || false,
        publishedUrl: vibeDoc.publishedUrl,
      };
    }
    return null;
  } catch (error) {
    // Return null if there's any error loading this vibe
    return null;
  }
}

/**
 * Lists all vibes stored locally by querying IndexedDB for databases with names
 * starting with 'fp.vibe-' and retrieving the vibe document from each
 * @returns Array of vibe objects with title, slug, id, and created fields
 */
export async function listLocalVibes(): Promise<LocalVibe[]> {
  try {
    // Get all available vibe IDs
    const vibeIds = await listLocalVibeIds();

    // Create an array of promises to fetch the vibe document for each ID
    const vibePromises = vibeIds.map((vibeId) => loadVibeDocument(vibeId));

    // Wait for all promises to resolve
    const results = await Promise.all(vibePromises);

    // Filter out null values and sort by creation date
    return results
      .filter((vibe): vibe is LocalVibe => vibe !== null)
      .sort(
        (b, a) => new Date(a.created).getTime() - new Date(b.created).getTime(),
      );
  } catch (error) {
    // Return empty array if there's any error in the process
    return [];
  }
}

/**
 * Delete a vibe database by its ID
 * @param vibeId The ID of the vibe to delete
 * @returns Promise that resolves when the database is deleted
 */
export async function deleteVibeDatabase(vibeId: string): Promise<void> {
  const dbName = `fp.vibe-${vibeId}`;
  await indexedDB.deleteDatabase(dbName);
}

/**
 * Toggle favorite status for a vibe
 * @param vibeId The ID of the vibe to toggle favorite status for
 * @param userId Optional user ID to update the user's vibe space database
 * @returns Promise that resolves to the updated vibe document
 */
export async function toggleVibeFavorite(
  vibeId: string,
  userId?: string,
): Promise<VibeDocument> {
  // Open the Fireproof database for this vibe
  const db = fireproof("vibe-" + vibeId);

  // Get the current vibe document
  const vibeDoc = (await db.get("vibe")) as VibeDocument;

  // Toggle the favorite status
  const updatedVibeDoc = {
    ...vibeDoc,
    favorite: !vibeDoc.favorite,
  };

  // Save the updated document
  await db.put(updatedVibeDoc);

  // If userId is provided AND the vibe has been published, update the user's space database
  if (userId && vibeDoc.publishedUrl) {
    try {
      // Extract the slug from the publishedUrl if available
      const slug = vibeDoc.publishedUrl.split("/").pop()?.split(".")[0] || "";

      // No need to fetch screenshots - they can be accessed via publishedUrl + 'screenshot.png'

      // Use the shared utility function to update the user's vibespace
      await updateUserVibespaceDoc(userId, slug, {
        id: vibeId, // Preserve the original vibeId
        favorite: updatedVibeDoc.favorite,
        title: vibeDoc.title,
        slug: slug,
        remixOf: vibeDoc.remixOf, // Include remixOf field
        publishedUrl: vibeDoc.publishedUrl,
        createdAt: vibeDoc.created_at,
      });

      // Successfully updated the vibe in user's space
    } catch (spaceError) {
      // Handle error but don't fail the entire operation
      // Silently continue if update to user space fails
    }
  } else if (userId) {
    // Skip updates for unpublished vibes
  }

  return updatedVibeDoc;
}
