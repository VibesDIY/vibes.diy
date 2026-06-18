import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { useNavigate, useSearchParams } from "react-router";
import { Chat } from "./chat.$ownerHandle.$appSlug.js";
import { toast } from "react-hot-toast";
import { useAuth } from "@clerk/react";
import { notifyRecentVibesChanged } from "../../hooks/useRecentVibes.js";

const PENDING_PROMPT_KEY = "vibes.pendingPrompt";

export function meta() {
  return [{ title: "New Chat - Vibes DIY" }, { name: "description", content: "Describe your vibe to make it a shareable app." }];
}

export default function ChatPrompt() {
  const { chatApi, sthis } = useVibesDiy();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasRun = useRef(false);
  const { isSignedIn, isLoaded } = useAuth();

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
    chatApi
      .getTokenClaims()
      .then((rClaims) => {
        if (rClaims.isErr()) {
          console.error("tokenClaims:", rClaims.Err());
          return Promise.reject();
        }
        return chatApi.openChat({
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
            notifyRecentVibesChanged();
            navigate(`/chat/${chat.ownerHandle}/${chat.appSlug}`);
          });
      });
  }, [effectivePrompt, isLoaded, isSignedIn]);

  return (
    <>
      <Chat inConstruction initialPrompt={effectivePrompt} />
      {isSignedIn &&
        effectivePrompt &&
        createPortal(
          // Full-screen layer that still intercepts pointer events (so the user
          // can't submit into the underlying chat input — which goes nowhere
          // while <Chat> is inConstruction) but is visually transparent, so the
          // decoded prompt renders as a user bubble that stays visible. The
          // "Preparing AI Session…" status sits in a bottom-anchored pill.
          <div
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 24,
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: "rgba(0,0,0,0.75)",
                color: "#fff",
                padding: "0.5rem 1rem",
                borderRadius: 9999,
                fontSize: "0.85rem",
              }}
            >
              Preparing AI Session…
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
