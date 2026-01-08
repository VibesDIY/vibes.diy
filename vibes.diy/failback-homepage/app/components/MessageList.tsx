import React, { memo, useMemo } from "react";
import Message from "./Message.js";
import type { ChatMessageDocument, ViewType } from "@vibes.diy/prompts";

export interface MessageListProps {
  messages: ChatMessageDocument[];
  isStreaming: boolean;
  setSelectedResponseId: (id: string) => void;
  selectedResponseId: string;
  setMobilePreviewShown: (shown: boolean) => void;
  navigateToView: (view: ViewType) => void;
}

function MessageList({
  messages,
  isStreaming,
  setSelectedResponseId,
  selectedResponseId,
  setMobilePreviewShown,
  navigateToView,
}: MessageListProps) {
  // Create a special message list when there's only one user message
  const shouldShowWaitingIndicator =
    messages.length === 1 && messages[0]?.type === "user";

  // Handle special case for waiting state
  const messageElements = useMemo(() => {
    // If we should show the waiting indicator instead of normal messages
    if (shouldShowWaitingIndicator) {
      return [
        // First show the user message
        <Message
          key={messages[0]._id || "user-message"}
          message={messages[0]}
          isStreaming={isStreaming}
          setSelectedResponseId={setSelectedResponseId}
          selectedResponseId={selectedResponseId}
          setMobilePreviewShown={setMobilePreviewShown}
          navigateToView={navigateToView}
        />,
        // Then show the waiting indicator
        <div
          key="waiting-indicator"
          className="mb-4 flex flex-row justify-start px-4"
        >
          <div className="mr-2 flex-shrink-0">
            <div className="bg-accent-02-light dark:bg-accent-02-dark flex h-8 w-8 items-center justify-center rounded-full shadow-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
                />
              </svg>
            </div>
          </div>
          <div className="text-light-primary dark:bg-dark-background-01 dark:text-dark-primary max-w-[85%] rounded-xl bg-white px-5 py-3 shadow-md">
            <div className="flex items-center space-x-1">
              <div
                className="accent-01 h-2 w-2 animate-pulse rounded-full opacity-75"
                style={{ animationDelay: "0ms" }}
              ></div>
              <div
                className="accent-01 h-2 w-2 animate-pulse rounded-full opacity-75"
                style={{ animationDelay: "300ms" }}
              ></div>
              <div
                className="accent-01 h-2 w-2 animate-pulse rounded-full opacity-75"
                style={{ animationDelay: "600ms" }}
              ></div>
            </div>
          </div>
        </div>,
      ];
    }

    // Otherwise, just render normal messages
    // Find the index of the latest AI message for streaming indicator
    const latestAiMessageIndex = messages
      .map((msg) => msg.type)
      .lastIndexOf("ai");

    return messages.map((msg, i) => {
      // Only show the streaming indicator on the latest AI message
      const isLatestAiMessage =
        isStreaming && i === latestAiMessageIndex && msg.type === "ai";

      return (
        <Message
          key={msg._id || "streaming" + i}
          message={msg}
          isStreaming={isStreaming}
          setSelectedResponseId={setSelectedResponseId}
          selectedResponseId={selectedResponseId}
          setMobilePreviewShown={setMobilePreviewShown}
          navigateToView={navigateToView}
          isLatestMessage={isLatestAiMessage}
        />
      );
    });
  }, [
    messages,
    isStreaming,
    setSelectedResponseId,
    selectedResponseId,
    setMobilePreviewShown,
    navigateToView,
    shouldShowWaitingIndicator,
  ]);

  return (
    <div className="flex-1">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col py-4">
        <div className="flex flex-col space-y-4">{messageElements}</div>
      </div>
    </div>
  );
}
export default memo(MessageList, (prevProps, nextProps) => {
  // Reference equality check for isStreaming flag
  const streamingStateEqual = prevProps.isStreaming === nextProps.isStreaming;

  // Check if setSelectedResponseId changed
  const setSelectedResponseIdEqual =
    prevProps.setSelectedResponseId === nextProps.setSelectedResponseId;

  // Check if selectedResponseId changed
  const selectedResponseIdEqual =
    prevProps.selectedResponseId === nextProps.selectedResponseId;

  // Check if setMobilePreviewShown changed
  const setMobilePreviewShownEqual =
    prevProps.setMobilePreviewShown === nextProps.setMobilePreviewShown;

  // Content equality check for messages - must compare text content
  const messagesEqual =
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.messages.every((msg, i) => {
      const nextMsg = nextProps.messages[i];
      // Check message ID and text content
      return msg._id === nextMsg._id && msg.text === nextMsg.text;
    });

  // Check if navigateToView changed
  const navigateToViewEqual =
    prevProps.navigateToView === nextProps.navigateToView;

  return (
    streamingStateEqual &&
    messagesEqual &&
    setSelectedResponseIdEqual &&
    selectedResponseIdEqual &&
    setMobilePreviewShownEqual &&
    navigateToViewEqual
  );
});
