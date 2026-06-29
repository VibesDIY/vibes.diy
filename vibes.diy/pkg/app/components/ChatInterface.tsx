import React, { useEffect, useRef } from "react";
import { useParams } from "react-router";
// import type { ChatInterfaceProps } from "@vibes.diy/prompts";
import MessageList from "./MessageList.js";
import WelcomeScreen from "./WelcomeScreen.js";
import type { PromptState } from "../routes/chat/prompt-state.js";
import { PromptError } from "@vibes.diy/api-types";

function ChatInterface({
  promptState,
  onClick,
  onDiffClick,
  onRetry,
  onSelectOption,
  optimisticPrompt,
}: {
  promptState: PromptState;
  onClick: (a: { fsId: string; appSlug: string; ownerHandle: string }) => void;
  onDiffClick?: (diff: { path: string; lines: string[] } | null) => void;
  onRetry?: (msg: PromptError) => void;
  onSelectOption?: (option: string) => boolean | undefined | Promise<boolean | undefined>;
  optimisticPrompt?: string;
}) {
  const { fsId } = useParams<{ fsId?: string }>();
  const { running, blocks } = promptState;
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Show the message list (not the welcome screen) the instant an optimistic
  // prompt exists, even before the first server block arrives — otherwise a
  // brand-new chat's first message would still feel lost until round-trip.
  const hasMessages = blocks.length > 0 || !!optimisticPrompt;

  // console.log(
  //   "ChatInterface",
  //   runtimeFn().isBrowser,
  //   running,
  //   blocks.length,
  //   blocks.reduce((a, i) => a + i.msgs.length, 1)
  // );

  useEffect(() => {
    if (messagesContainerRef.current && hasMessages) {
      try {
        // Since we're using flex-col-reverse, we need to scroll to the top to see the latest messages
        messagesContainerRef.current.scrollTop = 0;
      } catch (error) {
        console.error("Error scrolling to bottom:", error);
      }
    }
  }, [blocks.length, running, optimisticPrompt, hasMessages]);

  return (
    <div className="flex h-full flex-col">
      {hasMessages ? (
        <div ref={messagesContainerRef} className="flex flex-grow flex-col-reverse overflow-y-auto">
          <MessageList
            onClick={onClick}
            onDiffClick={onDiffClick}
            onRetry={onRetry}
            onSelectOption={onSelectOption}
            promptBlocks={blocks}
            promptProcessing={running}
            optimisticPrompt={optimisticPrompt}
            chatId={promptState.chat.chatId}
            selectedFsId={fsId}
            agentSavedBlockIds={promptState.agentSavedBlockIds}

            // setSelectedResponseId={setSelectedResponseId}
            // selectedResponseId={selectedResponseDoc?._id || ""}
            // setMobilePreviewShown={setMobilePreviewShown}
            // navigateToView={navigateToView}
          />
        </div>
      ) : (
        <div className="flex flex-grow items-center justify-center">
          <WelcomeScreen />
        </div>
      )}
    </div>
  );
}

export default ChatInterface;
