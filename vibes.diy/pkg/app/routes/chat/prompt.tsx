import React, { useEffect } from "react";
import { useVibeDiy } from "../../vibe-diy-provider.js";
import { useNavigate, useSearchParams } from "react-router";

export default function ChatPrompt() {
  const { vibeDiyApi } = useVibeDiy();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const prompt64 = searchParams.get("prompt64");

  useEffect(() => {
    if (!prompt64) {
      return;
    }
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
          console.error(`Error in useCallAIV2: ${rChat.Err()}`);
          return;
        }
        const chat = rChat.Ok();
        const prompt = atob(prompt64);
        // Send prompt (fire-and-forget) — chat route will pick up the stream
        chat.prompt({
          messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        });
        // Navigate immediately without prompt64
        navigate(`/chat/${chat.userSlug}/${chat.appSlug}?view=code`);
      });
  }, [prompt64]);
  return <div>Preparing AI - Session</div>;
}
