import React, { useCallback, useState } from "react";
import { useNewSessionChat } from "../hooks/useNewSessionChat.js";
import ChatInput from "./ChatInput.js";
import FeaturedVibes from "./FeaturedVibes.js";
import SessionSidebar from "./SessionSidebar.js";
import { MenuIcon } from "./ChatHeaderIcons.js";
import { BrutalistCard, VibesButton } from "@vibes.diy/use-vibes-base";
import {
  partyPlannerPrompt,
  progressTrackerPrompt,
  jamSessionPrompt,
} from "../data/quick-suggestions-data.js";
import models from "../data/models.json" with { type: "json" };
import { Toaster } from "react-hot-toast";

interface NewSessionViewProps {
  onSessionCreate: (sessionId: string) => void;
}

export default function NewSessionView({
  onSessionCreate,
}: NewSessionViewProps) {
  const chatState = useNewSessionChat(onSessionCreate);

  // Sidebar state
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  // Sidebar handlers
  const openSidebar = useCallback(() => {
    setIsSidebarVisible(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback(
    (suggestion: string) => {
      chatState.setInput(suggestion);

      // Focus the input and position cursor at the end
      setTimeout(() => {
        if (chatState.inputRef.current) {
          chatState.inputRef.current.focus();
          // Move cursor to end of text
          chatState.inputRef.current.selectionStart =
            chatState.inputRef.current.selectionEnd = suggestion.length;
        }
      }, 0);
    },
    [chatState.setInput, chatState.inputRef],
  );

  return (
    <>
      <div>
        <Toaster />
      </div>
      <div className="page-grid-background grid-background min-h-screen min-h-[100svh] min-h-[100dvh] w-full">
        {/* Header with menu button */}
        <div className="flex items-center justify-between p-4">
          <button
            type="button"
            onClick={openSidebar}
            className="mr-3 px-2 py-4 text-light-primary hover:text-accent-02-light dark:text-dark-primary dark:hover:text-accent-02-dark"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <div className="flex-1" />
        </div>

        {/* Main content section */}
        <div className="flex-1 px-8 pb-8">
          <div
            style={{
              maxWidth: "800px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              margin: "0 auto",
            }}
          >
            <BrutalistCard size="lg">
              <h1 className="text-4xl font-bold">Vibes are for sharing</h1>
            </BrutalistCard>

            {/* Prompt suggestions section */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <VibesButton
                variant="primary"
                style={{ flex: "1" }}
                onClick={() => handleSelectSuggestion(partyPlannerPrompt)}
              >
                Party Planner
              </VibesButton>
              <VibesButton
                variant="secondary"
                style={{ flex: "1" }}
                onClick={() => handleSelectSuggestion(progressTrackerPrompt)}
              >
                Progress Tracker
              </VibesButton>
              <VibesButton
                variant="tertiary"
                style={{ flex: "1" }}
                onClick={() => handleSelectSuggestion(jamSessionPrompt)}
              >
                Jam Session
              </VibesButton>
            </div>

            {/* Chat input form */}
            <BrutalistCard size="md" style={{ width: "100%" }}>
              <div style={{ marginBottom: "12px", fontWeight: 600 }}>
                Describe your vibe
              </div>
              <ChatInput
                chatState={chatState}
                showModelPickerInChat={chatState.showModelPickerInChat}
                currentModel={chatState.effectiveModel}
                onModelChange={async (modelId: string) => {
                  if (chatState.updateSelectedModel) {
                    await chatState.updateSelectedModel(modelId);
                  }
                }}
                models={
                  models as {
                    id: string;
                    name: string;
                    description: string;
                    featured?: boolean;
                  }[]
                }
                globalModel={chatState.globalModel}
                onSend={() => {
                  // Session creation is handled in chatState.sendMessage
                }}
              />
            </BrutalistCard>

            {/* Featured vibes section */}
            <BrutalistCard size="lg">
              <p>Enjoy our</p>
              <h2 className="text-2xl font-bold">Featured vibes</h2>
            </BrutalistCard>

            <FeaturedVibes count={3} />
          </div>
        </div>
      </div>
      <SessionSidebar
        isVisible={isSidebarVisible}
        onClose={closeSidebar}
        sessionId=""
      />
    </>
  );
}
