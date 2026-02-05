import { consumeStream } from "@adviser/cement";
import { LLMChat } from "@vibes.diy/api-impl";
import { resError, sectionEvent } from "@vibes.diy/api-types";
import { isPromptBlockBegin, isPromptBlockEnd, isCodeBegin } from "@vibes.diy/call-ai-v2";
import { TitleSrc } from "@vibes.diy/prompts";
import { RuntimeError } from "@vibes.diy/use-vibes-types";
import { type } from "arktype";
import { useState, useEffect, useRef } from "react";
import { UseCallAIV2Params } from "../types/models.js";
import { useVibeDiy } from "../vibe-diy-provider.js";

export function useCallAIV2({ title: givenTitle, model: givenModel }: UseCallAIV2Params) {
  const { vibeDiyApi } = useVibeDiy();
  const [title, setTitle] = useState<TitleSrc>({ title: givenTitle ?? "", src: "url" });
  const [model, setModel] = useState(givenModel);
  const [chat, setChat] = useState<null | LLMChat>(null);
  const [error, setError] = useState<null | Error | RuntimeError>(null);
  const [hasCode, setHasCode] = useState<boolean>(false);
  const [promptProcessing, setPromptProcessing] = useState(false);

  useEffect(() => {
    console.log("useCallAIV2 starting chat with model:", model);
    vibeDiyApi.openChat({}).then((rChat) => {
      if (rChat.isErr()) {
        console.error(`Error in useCallAIV2: ${rChat.Err()}`);
        setError(rChat.Err());
        return;
      }
      console.log("useCallAIV2 started chat with model:", model, rChat.Ok());
      setChat(rChat.Ok());
      consumeStream(rChat.Ok().sectionStream, (msg) => {
        console.log("useCallAIV2 received stream message:", msg);
        const isError = resError(msg);
        if (!(isError instanceof type.errors)) {
          setError(new Error(isError.message));
          return;
        }
        const se = sectionEvent(msg);
        if (se instanceof type.errors) {
          return;
        }
        for (const block of se.blocks) {
          switch (true) {
            case isPromptBlockBegin(block):
              setPromptProcessing(true);
              break;
            case isPromptBlockEnd(block):
              setPromptProcessing(false);
              break;
            case isCodeBegin(block):
              setHasCode(true);
              break;
          }
        }
      });
    });
  }, [chat]);
  const [_screenShot, setScreenshot] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [promptSend, setPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (promptSend) {
      console.log("the prompt", promptSend);
    }
  }, [promptSend]);

  const [input, setInput] = useState<string | null>(null);
  return {
    model,
    setModel,
    hasCode,
    title,
    setTitle,
    promptProcessing,
    setError,
    error,
    chat,
    inputRef,
    setScreenshot,
    sendPrompt: (prompt: string) => !promptProcessing && setPrompt(prompt),
    input,
    setInput,
  };
}
