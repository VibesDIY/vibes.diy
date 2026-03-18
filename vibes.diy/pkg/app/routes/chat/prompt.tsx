import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useVibeDiy } from "../../vibe-diy-provider.js";
import { useNavigate, useSearchParams } from "react-router";
import { Chat } from "./chat.$userSlug.$appSlug.js";
import { toast } from "react-hot-toast";
import { useAuth } from "@clerk/react";

export default function ChatPrompt() {
  const { vibeDiyApi, sthis } = useVibeDiy();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasRun = useRef(false);
  const { isSignedIn, isLoaded } = useAuth();

  const prompt64 = searchParams.get("prompt64");

  useEffect(() => {
    if (!prompt64 || hasRun.current || !isLoaded || !isSignedIn) {
      return;
    }
    hasRun.current = true;
    const prompt = sthis.txt.base64.decode(prompt64);
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
          mode: "creation",
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
            navigate(`/chat/${chat.userSlug}/${chat.appSlug}`);
          });
      });
  }, [prompt64, isLoaded, isSignedIn]);

  return (
    <>
      <Chat inConstruction />
      {createPortal(
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
