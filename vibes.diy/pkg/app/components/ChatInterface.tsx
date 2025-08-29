import React, { useEffect, useMemo, useRef } from "react";
import type { ChatInterfaceProps } from "@vibes.diy/prompts";
import MessageList from "./MessageList.js";
import WelcomeScreen from "./WelcomeScreen.js";

function ChatInterface({
  docs: messages,
  isStreaming,
  selectedResponseDoc,
  setSelectedResponseId,
  setMobilePreviewShown,
  navigateToView,
}: ChatInterfaceProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      try {
        // Since we're using flex-col-reverse, we need to scroll to the top to see the latest messages
        messagesContainerRef.current.scrollTop = 0;
      } catch (error) {
        console.error("Error scrolling to bottom:", error);
      }
    }
  }, [messages.length, isStreaming]);

  const memoizedMessageList = useMemo(() => {
    return (
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        setSelectedResponseId={setSelectedResponseId}
        selectedResponseId={selectedResponseDoc?._id || ""}
        setMobilePreviewShown={setMobilePreviewShown}
        navigateToView={navigateToView}
      />
    );
  }, [
    messages,
    isStreaming,
    setSelectedResponseId,
    selectedResponseDoc,
    setMobilePreviewShown,
    navigateToView,
  ]);

  return (
    <div className="flex h-full flex-col">
      {messages.length > 0 ? (
        <div
          ref={messagesContainerRef}
          className="flex flex-grow flex-col-reverse overflow-y-auto"
        >
          {memoizedMessageList}
        </div>
      ) : (
        <div className="flex flex-grow flex-col justify-between">
          <div className="flex-grow pb-4">
            <WelcomeScreen />
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatInterface;
