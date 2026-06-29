import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { usePortalRoot } from "../../contexts/PortalRootContext.js";
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
  const portalRoot = usePortalRoot();

  const prompt64 = searchParams.get("prompt64");

  // Snapshot sessionStorage once on mount so the fallback survives a lost URL param
  // (Clerk's OAuth round-trip can drop the query string before we get here).
  const [sessionPrompt] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(PENDING_PROMPT_KEY) ?? "";
  });

  const effectivePrompt = prompt64 ? sthis.txt.base64.decode(prompt64) : sessionPrompt;

  // Seed the sessionStorage fallback from a URL-only prompt64 so a signed-OUT
  // visitor doesn't lose the prompt across the Clerk sign-in round-trip (which
  // can strip the query string). The homepage flow seeds this storage before
  // navigating, but a cross-origin createVibe() hand-off (#2690) can only pass
  // the prompt via the URL — without this, a meta-vibe's brief is unrecoverable
  // if the user has to sign in. Cleared by the codegen effect once it runs.
  useEffect(() => {
    if (prompt64 && effectivePrompt && typeof window !== "undefined") {
      sessionStorage.setItem(PENDING_PROMPT_KEY, effectivePrompt);
    }
  }, [prompt64, effectivePrompt]);

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
          mode: "codegen",
          prompt,
        });
      })
      .then((rChat) => {
        if (rChat.isErr()) {
          toast.error(`Error in useCallAIV2: ${rChat.Err().message}`);
          return;
        }
        const chat = rChat.Ok();
        notifyRecentVibesChanged();
        // First-build on /vibe (experiment toward retiring /chat, #2518): the slug
        // now exists, so the vibe route resolves the creator as owner and its
        // ?prompt64 auto-fire drives first-generation IN PLACE (stream → hot-swap →
        // de-blur) via useInVibeGeneration — same path as an in-place edit, just
        // starting from an empty app. We mint the slug here but do NOT fire the
        // prompt on the chat plane; /vibe owns the generation so the firstgen
        // stream renders on the destination. /chat/$o/$s stays a live route.
        const p64 = prompt64 ?? sthis.txt.base64.encode(prompt);
        navigate(`/vibe/${chat.ownerHandle}/${chat.appSlug}?prompt64=${encodeURIComponent(p64)}`);
      });
  }, [effectivePrompt, isLoaded, isSignedIn]);

  return (
    <>
      <Chat inConstruction initialPrompt={effectivePrompt} />
      {isSignedIn &&
        effectivePrompt &&
        portalRoot &&
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
          portalRoot
        )}
    </>
  );
}
