import React, { useCallback, useEffect, useRef, useState } from "react";
import ChatInput, { ChatInputRef } from "./ChatInput.js";
import FeaturedVibes from "./FeaturedVibes.js";
import SessionSidebar from "./SessionSidebar.js";
import { partyPlannerPrompt, progressTrackerPrompt, jamSessionPrompt } from "../data/quick-suggestions-data.js";
import { featuredModels } from "../data/models.js";
import { Toaster } from "react-hot-toast";
import { useVibeDiy } from "../vibe-diy-provider.js";
import { useNavigate } from "react-router";
import { BuildURI } from "@adviser/cement";
import { VibesSwitch, BrutalistCard, VibesButton } from "@vibes.diy/base";

export default function HomePage() {
  // Sidebar state
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);

  // Sidebar handler
  const closeSidebar = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  // const promptTextRef = useRef<HTMLTextAreaElement>(null)

  const chatInput = useRef<ChatInputRef>(null);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback(
    (suggestion: string) => {
      if (!chatInput.current) {
        return;
      }
      chatInput.current.setPrompt(suggestion);
      // Focus the input and position cursor at the end
      setTimeout(() => {
        if (chatInput.current) {
          chatInput.current.setFocus();
          // Move cursor to end of text
          chatInput.current.setSelection(suggestion.length, suggestion.length);
        }
      }, 0);
    },
    [chatInput]
  );

  const { sthis } = useVibeDiy();
  const navigate = useNavigate();
  // const [chat, setChat] = useState<LLMChat | null>()

  useEffect(() => {
    if (!prompt?.trim()) {
      return;
    }
    navigate(BuildURI.from(location.href).pathname("/chat/prompt").setParam("prompt64", sthis.txt.base64.encode(prompt)).withoutHostAndSchema)
  }, [prompt]);

  return (
    <>
      <div>
        <Toaster />
      </div>
      <div className="page-grid-background grid-background min-h-screen min-h-[100svh] min-h-[100dvh] w-full">
        <div className="px-8 pb-8 pt-0">
          {/* Hamburger menu button - top left in normal flow with z-index */}
          <div className="mb-8 ml-6 relative z-20">
            <VibesSwitch size={75} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
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
              <h1 className="text-4xl font-bold">Code is easy, now</h1>
            </BrutalistCard>

            {/* Prompt suggestions section */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <VibesButton variant="blue" style={{ flex: "1" }} onClick={() => handleSelectSuggestion(partyPlannerPrompt)}>
                Party Planner
              </VibesButton>
              <VibesButton variant="red" style={{ flex: "1" }} onClick={() => handleSelectSuggestion(progressTrackerPrompt)}>
                Random App
              </VibesButton>
              <VibesButton variant="yellow" style={{ flex: "1" }} onClick={() => handleSelectSuggestion(jamSessionPrompt)}>
                Jam Session
              </VibesButton>
            </div>

            {/* Chat input form */}
            <BrutalistCard
              size="md"
              style={{
                width: "100%",
                background: "var(--vibes-gray-lighter)",
              }}
            >
              <div
                style={{
                  marginBottom: "12px",
                  fontWeight: 700,
                  fontSize: "1.125rem",
                }}
              >
                Vibe code apps instantly
              </div>
              <ChatInput
                ref={chatInput}
                models={featuredModels}
                // promptTextRef={promptTextRef}
                // globalModel={chatState.globalModel}
                onSubmit={setPrompt}
                promptProcessing={false}
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
      <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} sessionId="" />
    </>
  );
}
