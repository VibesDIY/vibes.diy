import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import StructuredMessage from "./StructuredMessage.js";
import type {
  ChatMessageDocument,
  AiChatMessageDocument,
  SystemChatMessageDocument,
  ViewType,
} from "@vibes.diy/prompts";
import { parseContent } from "@vibes.diy/prompts";
import { BrutalistCard } from "@vibes.diy/use-vibes-base";

interface MessageProps {
  message: ChatMessageDocument;
  isStreaming: boolean;
  setSelectedResponseId: (id: string) => void;
  selectedResponseId: string;
  setMobilePreviewShown: (shown: boolean) => void;
  navigateToView: (view: ViewType) => void;
  isLatestMessage?: boolean; // Flag to indicate if this is the latest AI message for showing the streaming indicator
}

// AI Message component (simplified without animation handling)
const AIMessage = memo(
  ({
    message,
    model,
    isStreaming,
    setSelectedResponseId,
    selectedResponseId,
    setMobilePreviewShown,
    navigateToView,
    isLatestMessage,
  }: {
    message: AiChatMessageDocument;
    model?: string;
    isStreaming: boolean;
    setSelectedResponseId: (id: string) => void;
    selectedResponseId: string;
    setMobilePreviewShown: (shown: boolean) => void;
    navigateToView: (view: ViewType) => void;
    isLatestMessage?: boolean;
  }) => {
    const { segments } = parseContent(message.text);
    return (
      <div className="mb-4 flex flex-row justify-start px-4">
        <div className="mr-2 flex-shrink-0">
          <div
            className="bg-light-decorative-02 dark:bg-dark-decorative-02 flex h-8 w-8 items-center justify-center rounded-full shadow-sm"
            title={model || undefined}
          >
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
        <div className="max-w-[85%]">
          <StructuredMessage
            segments={segments || []}
            isStreaming={isStreaming}
            messageId={message._id}
            setSelectedResponseId={setSelectedResponseId}
            selectedResponseId={selectedResponseId}
            setMobilePreviewShown={setMobilePreviewShown}
            rawText={message.text}
            navigateToView={navigateToView}
            isLatestMessage={isLatestMessage}
          />
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // If either the message text or streaming state changed, we need to re-render
    // Return false to signal React to re-render the component
    if (
      prevProps.message.text !== nextProps.message.text ||
      prevProps.isStreaming !== nextProps.isStreaming ||
      prevProps.setSelectedResponseId !== nextProps.setSelectedResponseId ||
      prevProps.selectedResponseId !== nextProps.selectedResponseId ||
      prevProps.setMobilePreviewShown !== nextProps.setMobilePreviewShown ||
      prevProps.navigateToView !== nextProps.navigateToView ||
      prevProps.isLatestMessage !== nextProps.isLatestMessage
    ) {
      return false;
    }
    // Otherwise, skip re-render
    return true;
  },
);

const UserMessage = memo(({ message }: { message: ChatMessageDocument }) => {
  return (
    <div className="mb-4 flex flex-row justify-end px-4">
      <BrutalistCard size="md" className="max-w-[85%]">
        <div className="prose prose-sm dark:prose-invert prose-ul:pl-5 prose-ul:list-disc prose-ol:pl-5 prose-ol:list-decimal prose-li:my-0 max-w-none">
          <ReactMarkdown>{message.text}</ReactMarkdown>
        </div>
      </BrutalistCard>
    </div>
  );
});

// System Message component for errors and system notifications
const SystemMessage = memo(
  ({ message }: { message: SystemChatMessageDocument }) => {
    // Format error message for display - parse error details
    const lines = message.text.split("\n");
    const errorTitle = lines[0] || "System Message";
    const errorDetails = lines.slice(1).join("\n");

    // Map error category to BrutalistCard variant
    const variant = message.errorCategory === "immediate"
      ? "error"
      : message.errorCategory === "advisory"
        ? "warning"
        : "default";

    return (
      <div className="mb-4 flex flex-row justify-center px-4">
        <BrutalistCard variant={variant} size="lg" className="max-w-[80%]">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h4 className="m-0 font-semibold">{errorTitle}</h4>
            {errorDetails && (
              <pre className="mt-2 max-h-[200px] overflow-auto font-mono text-xs whitespace-pre-wrap">
                {errorDetails}
              </pre>
            )}
          </div>
        </BrutalistCard>
      </div>
    );
  },
);

// Main Message component that handles animation and decides which subcomponent to render
const Message = memo(
  ({
    message,
    isStreaming,
    setSelectedResponseId,
    selectedResponseId,
    setMobilePreviewShown,
    navigateToView,
    isLatestMessage,
  }: MessageProps) => {
    return (
      <div className="transition-all duration-150 ease-in hover:opacity-95">
        {message.type === "ai" ? (
          <AIMessage
            message={message as AiChatMessageDocument}
            model={message.model}
            isStreaming={isStreaming}
            setSelectedResponseId={setSelectedResponseId}
            selectedResponseId={selectedResponseId}
            setMobilePreviewShown={setMobilePreviewShown}
            navigateToView={navigateToView}
            isLatestMessage={isLatestMessage}
          />
        ) : message.type === "system" ? (
          <SystemMessage message={message as SystemChatMessageDocument} />
        ) : (
          <UserMessage message={message} />
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Check for message content changes
    if (prevProps.message.text !== nextProps.message.text) {
      return false; // Text changed, need to re-render
    }

    // Check for streaming state changes
    if (prevProps.isStreaming !== nextProps.isStreaming) {
      return false; // State changed, need to re-render
    }

    // Check if the setSelectedResponseId function reference changed
    if (prevProps.setSelectedResponseId !== nextProps.setSelectedResponseId) {
      return false; // Function reference changed, need to re-render
    }

    // Check if selectedResponseId changed
    if (prevProps.selectedResponseId !== nextProps.selectedResponseId) {
      return false; // Selection changed, need to re-render
    }

    // Check if setMobilePreviewShown changed
    if (prevProps.setMobilePreviewShown !== nextProps.setMobilePreviewShown) {
      return false; // Mobile preview function changed, need to re-render
    }

    // Check if navigateToView changed
    if (prevProps.navigateToView !== nextProps.navigateToView) {
      return false; // Active view function changed, need to re-render
    }

    // Check if isLatestMessage changed
    if (prevProps.isLatestMessage !== nextProps.isLatestMessage) {
      return false; // Latest message flag changed, need to re-render
    }

    // If we get here, props are equal enough to skip re-render
    return true;
  },
);

export default Message;
