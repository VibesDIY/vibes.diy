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

        // Auto-submit after ensuring streaming has completed
        // Poll until button is enabled (not disabled), then click it
        const checkAndSubmit = () => {
          const buttons = document.querySelectorAll("button");
          const codeButton = Array.from(buttons).find(
            (btn) => btn.textContent?.trim() === "Code",
          );

          if (codeButton) {
            if (!codeButton.hasAttribute("disabled")) {
              // Button is enabled, click it
              codeButton.click();
            } else {
              // Button still disabled (streaming), check again in 100ms
              setTimeout(checkAndSubmit, 100);
            }
          } else {
            // Button not found, retry in 100ms
            setTimeout(checkAndSubmit, 100);
          }
        };

        // Start checking after a small initial delay
        setTimeout(checkAndSubmit, 2000);

        debouncedSendRef.current = null;
      }, 1000);
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
