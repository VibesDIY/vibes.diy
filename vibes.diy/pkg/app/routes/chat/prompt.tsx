import React, { useEffect } from "react";
import { useVibeDiy } from "../../vibe-diy-provider.js";
import { useNavigate, useSearchParams } from "react-router";

export default function ChatPrompt() {
  const { vibeDiyApi, sthis } = useVibeDiy();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const prompt64 = searchParams.get("prompt64");

  useEffect(() => {
    if (!prompt64) {
      return;
    }
    const prompt = sthis.txt.base64.decode(prompt64)
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
            // chat.close()
            if (rPrompt.isErr()) {
              console.error("sendPrompt failed", rPrompt.Err());
              return;
            } else {
              navigate(`/chat/${chat.userSlug}/${chat.appSlug}`);
            }
          });
      });
  }, [prompt64]);
  return <div>Preparing AI - Session</div>
}
