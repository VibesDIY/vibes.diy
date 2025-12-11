import { Database } from "@fireproof/use-fireproof";
import type { ErrorCategory } from "./useRuntimeErrors.js";
import { RuntimeError } from "@vibes.diy/use-vibes-types";

export async function saveErrorAsSystemMessage(
  sessionDatabase: Database,
  sessionId: string | undefined,
  error: RuntimeError,
  category: ErrorCategory,
) {
  if (!sessionDatabase) return;

  const errorType = error.errorType || "Unknown";
  const errorReason = error.reason || "Unknown reason";
  const errorMessage = error.message || "No message";
  const errorSource = error.source || "Unknown source";

  const systemMessageText = `ERROR [${category}]: ${errorType}\n${errorMessage}\n${errorReason}\nSource: ${errorSource}\nStack: ${error.stack || "No stack trace"}\nTimestamp: ${error.timestamp}`;

  const systemMessage = {
    type: "system",
    session_id: sessionId || "",
    text: systemMessageText,
    created_at: Date.now(),
    errorType,
    errorCategory: category,
  };

  try {
    await sessionDatabase.put(systemMessage);
  } catch (err) {
    console.error("Failed to save error as system message:", err);
  }
}
