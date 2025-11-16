import { useMemo, useCallback, useEffect, useRef } from "react";
import type { Segment, ChatMessageDocument } from "@vibes.diy/prompts";
import { parseContent } from "@vibes.diy/prompts";

/**
 * Hook for managing message selection and content processing
 * @param options - Configuration options including docs, streaming state, and messages
 * @returns Object with selected message data and utility functions
 */
export function useMessageSelection({
  docs,
  isStreaming,
  aiMessage,
  selectedResponseId,
  pendingAiMessage,
}: {
  docs: ChatMessageDocument[];
  isStreaming: boolean;
  aiMessage: ChatMessageDocument;
  selectedResponseId: string;
  pendingAiMessage: ChatMessageDocument | null;
}) {
  const prevMessageCountRef = useRef<number>(0);

  const messages = useMemo(() => {
    // First filter the docs to get messages we want to display
    const baseDocs = docs.filter(
      (doc) =>
        doc.type === "ai" || doc.type === "user" || doc.type === "system",
    ) as unknown as ChatMessageDocument[];

    // If currently streaming, merge streaming content onto placeholder IN MEMORY
    if (isStreaming && aiMessage.text.length > 0) {
      return baseDocs.map((doc) => {
        // Find the placeholder with isStreaming flag and merge content
        if (doc.type === "ai" && doc.isStreaming) {
          return { ...doc, text: aiMessage.text };
        }
        return doc;
      });
    }

    // Default case - just use the messages from the database
    return baseDocs;
  }, [docs, isStreaming, aiMessage]);

  // Log message changes for debugging disappearance issues
  useEffect(() => {
    if (messages.length !== prevMessageCountRef.current) {
      console.log(
        `[MESSAGE_COUNT_CHANGE] ${prevMessageCountRef.current} → ${messages.length}`,
      );
      messages.forEach((msg, idx) => {
        console.log(
          `  [${idx}] type=${msg.type} _id=${msg._id || "none"} textLength=${msg.text?.length || 0} isStreaming=${(msg as any).isStreaming || false}`,
        );
      });
      prevMessageCountRef.current = messages.length;
    }
  }, [messages]);

  const selectedResponseDoc = useMemo(() => {
    // Priority 1: Explicit user selection (from confirmed docs)
    if (selectedResponseId) {
      const foundInDocs = docs.find(
        (doc) => doc.type === "ai" && doc._id === selectedResponseId,
      );
      if (foundInDocs) return foundInDocs;
    }

    // Priority 2: Pending message (if no valid user selection)
    if (pendingAiMessage) {
      return pendingAiMessage;
    }

    // Priority 3: Streaming message (if no valid user selection and not pending)
    if (isStreaming) {
      return aiMessage;
    }

    // Priority 4: Default to latest AI message from docs that contains code
    const aiDocs = docs.filter((doc) => doc.type === "ai");

    // Find all docs that contain code when parsed
    const docsWithCode = aiDocs.filter((doc) => {
      const { segments } = parseContent(doc.text);
      return segments.some((s: Segment) => s.type === "code");
    });

    // Sort by document ID - this is more reliable than timestamps
    // when determining the most recent message, especially since IDs often have
    // chronological information encoded in them
    const sortedDocsWithCode = docsWithCode.sort(
      (a, b) => b._id?.localeCompare(a._id ?? "") || 0,
    );

    const latestAiDocWithCode = sortedDocsWithCode[0];
    return latestAiDocWithCode;
  }, [selectedResponseId, docs, pendingAiMessage, isStreaming, aiMessage]) as
    | ChatMessageDocument
    | undefined;

  // Process selected response into segments and code
  const { selectedSegments, selectedCode } = useMemo(() => {
    const { segments } = selectedResponseDoc
      ? parseContent(selectedResponseDoc.text)
      : { segments: [] };

    // First try to find code in the currently selected message
    let code = segments.find((segment) => segment.type === "code");

    // If no code was found and we have a valid selectedResponseDoc, look through all AI messages
    if (!code && selectedResponseDoc) {
      // Get all AI messages sorted from newest to oldest
      const aiMessages = docs
        .filter((doc) => doc.type === "ai")
        .sort((a, b) => b.created_at - a.created_at);

      // Look through each AI message until we find code
      for (const message of aiMessages) {
        // Skip the current message as we already checked it
        if (message._id === selectedResponseDoc._id) continue;

        const { segments: msgSegments } = parseContent(message.text);
        code = msgSegments.find((segment) => segment.type === "code");
        if (code) break; // Stop once we find code
      }
    }

    // Default empty segment if no code was found anywhere
    if (!code) code = { content: "" } as Segment;

    return {
      selectedSegments: segments,
      selectedCode: code,
    };
  }, [selectedResponseDoc, docs]);

  // Build message history for AI requests
  const filteredDocs = docs.filter(
    (doc) => doc.type === "ai" || doc.type === "user" || doc.type === "system",
  );
  const buildMessageHistory = useCallback((): {
    role: "user" | "assistant" | "system";
    content: string;
  }[] => {
    // Map all messages to the correct format first
    const allMessages = filteredDocs.map((msg) => {
      const role =
        msg.type === "user"
          ? ("user" as const)
          : msg.type === "system"
            ? ("system" as const)
            : ("assistant" as const);
      return {
        role,
        content: msg.text || "",
      };
    });

    // Handle shorter histories without duplicates
    if (allMessages.length <= 8) {
      return allMessages;
    }

    // For longer histories, get first 2 and last 6
    const firstMessages = allMessages.slice(0, 2);
    const lastMessages = allMessages.slice(-6);

    return [...firstMessages, ...lastMessages];
  }, [filteredDocs, docs]);

  return {
    messages,
    selectedResponseDoc,
    selectedSegments,
    selectedCode,
    buildMessageHistory,
  };
}
