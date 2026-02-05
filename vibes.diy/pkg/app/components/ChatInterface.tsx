import React, { useEffect, useRef } from "react";
// import type { ChatInterfaceProps } from "@vibes.diy/prompts";
import MessageList from "./MessageList.js";
import WelcomeScreen from "./WelcomeScreen.js";
import { PromptState } from "../routes/chat.$userSlug.$appSlug.js";

function ChatInterface({
  promptState,
  // selectedResponseDoc,
  // setSelectedResponseId,
  // setMobilePreviewShown,
  // navigateToView,
}: {
  promptState: PromptState;
}) {
  const { running, blocks } = promptState;
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // console.log(
  //   "ChatInterface",
  //   runtimeFn().isBrowser,
  //   running,
  //   blocks.length,
  //   blocks.reduce((a, i) => a + i.msgs.length, 1)
  // );

  useEffect(() => {
    if (messagesContainerRef.current && blocks.length > 0) {
      try {
        // Since we're using flex-col-reverse, we need to scroll to the top to see the latest messages
        messagesContainerRef.current.scrollTop = 0;
      } catch (error) {
        console.error("Error scrolling to bottom:", error);
      }
    }
  }, [blocks.length, running]);

  return (
    <div className="flex h-full flex-col">
      {blocks.length > 0 ? (
        <div ref={messagesContainerRef} className="flex flex-grow flex-col-reverse overflow-y-auto">
          <MessageList
            promptBlocks={blocks}
            promptProcessing={running}
            chatId={promptState.chat.chatId}
            // setSelectedResponseId={setSelectedResponseId}
            // selectedResponseId={selectedResponseDoc?._id || ""}
            // setMobilePreviewShown={setMobilePreviewShown}
            // navigateToView={navigateToView}
          />
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
