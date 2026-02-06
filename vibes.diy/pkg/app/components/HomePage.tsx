import React, { useCallback, useEffect, useRef, useState } from "react";
import ChatInput, { ChatInputRef } from "./ChatInput.js";
import FeaturedVibes from "./FeaturedVibes.js";
import SessionSidebar from "./SessionSidebar.js";
import { BrutalistCard } from "./vibes/BrutalistCard.js";
import { VibesButton } from "./vibes/VibesButton/index.js";
import { VibesSwitch } from "./vibes/VibesSwitch/VibesSwitch.js";
import { partyPlannerPrompt, progressTrackerPrompt, jamSessionPrompt } from "../data/quick-suggestions-data.js";
import { featuredModels } from "../data/models.js";
import toast, { Toaster } from "react-hot-toast";
import { useClerk } from "@clerk/clerk-react";
import { useVibeDiy } from "../vibe-diy-provider.js";
import { useNavigate } from "react-router";
import { LLMChat } from "@vibes.diy/api-impl";

export default function HomePage() {
  // Sidebar state
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const clerk = useClerk();
  const [chat, setChat] = useState<LLMChat | null>(null);

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

  const { vibeDiyApi } = useVibeDiy();
  const navigate = useNavigate();
  // const [chat, setChat] = useState<LLMChat | null>()

  useEffect(() => {
    if (!prompt) {
      return;
    }
    if (clerk.isSignedIn) {
      vibeDiyApi
        .getTokenClaims()
        .then((rClaims) => {
          if (rClaims.isErr()) {
            console.error("tokenClaims:", rClaims.Err());
            return Promise.reject();
          }
          const { params } = rClaims.Ok().claims;
          return vibeDiyApi.openChat({
            userSlug: params.name ?? params.nick ?? params.email.replace(/@[^@]+$/, ""),
          });
        })
        .then((rChat) => {
          if (rChat.isErr()) {
            console.error(`Error in useCallAIV2: ${rChat.Err()}`);
            // setError(rChat.Err())
            return;
          }
          console.log("ready to prompt", rChat.Ok().tid, rChat.Ok().chatId);
          const chat = rChat.Ok();
          setChat(chat);
          chat
            .prompt({
              messages: [
                {
                  role: "user",
                  content: [{ type: "text", text: prompt }],
                },
              ],
            })
            .then((rPrompt) => {
              if (rPrompt.isErr()) {
                console.error("sendPrompt failed", rPrompt.Err());
                return;
              } else {
                navigate(`/chat/${chat.userSlug}/${chat.appSlug}`);
              }
            });
        });
      return () => {
        if (chat) {
          chat.close().then(() => {
            console.log(`HomePage --- close`);
          });
        }
      };
    } else {
      toast.toast("needs login");
    }
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
