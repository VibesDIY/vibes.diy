import React, { useCallback, useState } from "react";
import { useNewSessionChat } from "../hooks/useNewSessionChat.js";
import ChatInput from "./ChatInput.js";
import FeaturedVibes from "./FeaturedVibes.js";
import SessionSidebar from "./SessionSidebar.js";
import {
  BrutalistCard,
  VibesButton,
  VibesSwitch,
} from "@vibes.diy/use-vibes-base";
import {
  partyPlannerPrompt,
  progressTrackerPrompt,
  jamSessionPrompt,
} from "../data/quick-suggestions-data.js";
import { featuredModels } from "../data/models.js";
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

  // Sidebar handler
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
        <div className="px-8 pb-8 pt-0">
          {/* Hamburger menu button - top left in normal flow with z-index */}
          <div className="mb-8 ml-6 relative z-20">
            <VibesSwitch
              size={75}
              isActive={isSidebarVisible}
              onToggle={setIsSidebarVisible}
              className="cursor-pointer"
            />
          </div>
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
                variant="blue"
                style={{ flex: "1" }}
                onClick={() => handleSelectSuggestion(partyPlannerPrompt)}
              >
                Party Planner
              </VibesButton>
              <VibesButton
                variant="red"
                style={{ flex: "1" }}
                onClick={() => handleSelectSuggestion(progressTrackerPrompt)}
              >
                Random App
              </VibesButton>
              <VibesButton
                variant="yellow"
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
                models={featuredModels}
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
