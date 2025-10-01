import { useEffect, useRef } from "react";
import type { UserChatMessageDocument } from "@vibes.diy/prompts";
import { RuntimeError } from "@vibes.diy/use-vibes-types";

interface Params {
  immediateErrors: RuntimeError[];
  isStreaming: boolean;
  userInput: string;
  mergeUserMessage: (doc: Partial<UserChatMessageDocument>) => void;
  setDidSendErrors: (value: boolean) => void;
  setIsStreaming: (value: boolean) => void;
}

export function useImmediateErrorAutoSend({
  immediateErrors,
  isStreaming,
  userInput,
  mergeUserMessage,
  setDidSendErrors,
  setIsStreaming,
}: Params) {
  const debouncedSendRef = useRef<NodeJS.Timeout | null>(null);
  const sentErrorsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (immediateErrors.length === 0) {
      return;
    }

    const fingerprint = immediateErrors
      .map((e) => `${e.errorType}:${e.message}`)
      .sort()
      .join("|");

    if (sentErrorsRef.current.has(fingerprint)) {
      return;
    }

    const hasSyntax = immediateErrors.some(
      (e) => e.errorType === "SyntaxError",
    );
    if (isStreaming && hasSyntax) {
      setIsStreaming(false);
    }

    if (!debouncedSendRef.current) {
      debouncedSendRef.current = setTimeout(() => {
        sentErrorsRef.current.add(fingerprint);
        mergeUserMessage({
          text: "Please help me fix the errors shown above. Simplify the code if necessary.",
        });
        setDidSendErrors(true);
        debouncedSendRef.current = null;
      }, 500);
    }

    return () => {
      if (debouncedSendRef.current) {
        clearTimeout(debouncedSendRef.current);
        debouncedSendRef.current = null;
      }
    };
  }, [
    immediateErrors,
    isStreaming,
    userInput,
    mergeUserMessage,
    setDidSendErrors,
    setIsStreaming,
  ]);
}
