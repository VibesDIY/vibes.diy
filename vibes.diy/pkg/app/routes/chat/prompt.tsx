import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { useNavigate, useSearchParams } from "react-router";
import { Chat } from "./chat.$userSlug.$appSlug.js";
import { toast } from "react-hot-toast";
import { useAuth } from "@clerk/react";
import { useRecentVibesData } from "../../contexts/RecentVibesContext.js";

const PENDING_PROMPT_KEY = "vibes.pendingPrompt";

export default function ChatPrompt() {
  const { vibeDiyApi, sthis } = useVibesDiy();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasRun = useRef(false);
  const { isSignedIn, isLoaded } = useAuth();
  const { refresh: refreshRecentVibes } = useRecentVibesData();

  const prompt64 = searchParams.get("prompt64");

  // Snapshot sessionStorage once on mount so the fallback survives a lost URL param
  // (Clerk's OAuth round-trip can drop the query string before we get here).
  const [sessionPrompt] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(PENDING_PROMPT_KEY) ?? "";
  });

  const effectivePrompt = prompt64 ? sthis.txt.base64.decode(prompt64) : sessionPrompt;

  useEffect(() => {
    if (!effectivePrompt || hasRun.current || !isLoaded || !isSignedIn) {
      return;
    }
    hasRun.current = true;
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(PENDING_PROMPT_KEY);
    }
    const prompt = effectivePrompt;
    vibeDiyApi
      .getTokenClaims()
      .then((rClaims) => {
        if (rClaims.isErr()) {
          console.error("tokenClaims:", rClaims.Err());
          return Promise.reject();
        }
        return vibeDiyApi.openChat({
          mode: "chat",
          prompt,
        });
      })
      .then((rChat) => {
        if (rChat.isErr()) {
          toast.error(`Error in useCallAIV2: ${rChat.Err().message}`);
          return;
        }
        const chat = rChat.Ok();
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
              toast.error(`sendPrompt failed: ${rPrompt.Err().message}`);
              return;
            }
            void refreshRecentVibes();
            navigate(`/chat/${chat.userSlug}/${chat.appSlug}`);
          });
      });
  }, [effectivePrompt, isLoaded, isSignedIn]);

  return (
    <>
      <Chat inConstruction />
      {isSignedIn &&
        effectivePrompt &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
          >
            Preparing AI Session…
          </div>,
          document.body
        )}
    </>
  );
}
