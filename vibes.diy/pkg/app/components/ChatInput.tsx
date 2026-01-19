import type { ChangeEvent, KeyboardEvent } from "react";
import React, { useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useState } from "react";
// import type { BaseChatState } from "@vibes.diy/prompts";
import ModelPicker, { type ModelOption } from "./ModelPicker.js";
import { Button } from "./ui/button.js";

interface ChatInputProps {
  promptProcessing: boolean;
  // promptTextRef: React.RefObject<HTMLTextAreaElement | null>;
  // promptTextRef?: React.RefObject<HTMLTextAreaElement | null>;

  // chatStatex: BaseChatState;
  onSubmit: (prompt: string) => void;
  // Optional model picker props (for backward compatibility in tests/stories)
  currentModel?: string;
  onModelChange?: (modelId: string) => void | Promise<void>;
  models?: ModelOption[];
  // globalModel?: string;
  showModelPickerInChat?: boolean;
}

export interface ChatInputRef extends HTMLTextAreaElement {
  clickSubmit: () => void;
  setFocus: () => void;
  setPrompt: (p: string) => void;
  setSelection: (start: number, end: number) => void;
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  (
    {
      promptProcessing, // promptTextRef: iPromptTextRef,
      onSubmit,
      currentModel,
      onModelChange,
      models,
      /*globalModel, */ showModelPickerInChat,
    },
    ref
  ) => {
    // Refs
    const submitButtonRef = useRef<HTMLButtonElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    // const promptTextRef = iPromptTextRef ?? useRef<HTMLTextAreaElement>(null)

    const [prompt, setPrompt] = useState<string | null>();

    // State for responsive behavior
    const [isCompact, setIsCompact] = useState(false);

    const realTextArea = useRef<HTMLTextAreaElement>(null);

    // Expose the click function to parent components
    useImperativeHandle(
      ref,
      () =>
        ({
          setFocus: () => {
            realTextArea.current?.focus();
          },
          setPrompt: (v) => {
            setPrompt(v);
          },
          setSelection: (s, e) => {
            if (realTextArea.current) {
              realTextArea.current.selectionStart = s;
              realTextArea.current.selectionEnd = e;
            }
          },
          clickSubmit: () => {
            if (submitButtonRef.current) {
              submitButtonRef.current.click();
            }
          },
        }) as ChatInputRef
    );

    // const [waitForNextRunning, setWaitForNextRunning] = useState<"idle" | "waitRunning" | "waitNotRunning">("idle");

    // // Internal callback to handle sending messages
    const handleSendPrompt = useCallback(() => {
      if (prompt && !promptProcessing) {
        onSubmit(prompt); // Call onSend for side effects only
        // setWaitForNextRunning("waitRunning");
      }
    }, [prompt, promptProcessing, onSubmit]);

    // if (waitForNextRunning === "waitRunning" && promptProcessing) {
    //   setWaitForNextRunning("waitNotRunning");
    // }
    // if (waitForNextRunning === "waitNotRunning" && !promptProcessing) {
    //   setWaitForNextRunning("idle");
    //   setPrompt("");
    // }

    // Auto-resize textarea function
    const autoResizeTextarea = useCallback(() => {
      // const textarea =ref;
      if (realTextArea.current) {
        realTextArea.current.style.height = "auto";
        const maxHeight = 200;
        const minHeight = 90;
        realTextArea.current.style.height = `${Math.max(minHeight, Math.min(maxHeight, realTextArea.current.scrollHeight))}px`;
      }
    }, [ref]);

    // Initial auto-resize
    useEffect(() => {
      autoResizeTextarea();
    }, [prompt, autoResizeTextarea]);

    // ResizeObserver to detect container width and set compact mode
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect.width;
          // Set breakpoint at 500px - adjust as needed
          setIsCompact(width < 400);
        }
      });
      resizeObserver.observe(container);
      return () => {
        resizeObserver.disconnect();
      };
    }, []);

    return (
      <div ref={containerRef} className="px-2 py-1">
        <div className="space-y-1">
          <textarea
            ref={realTextArea}
            value={prompt ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              setPrompt(e.target.value);
            }}
            onFocus={() => {
              // Fire and forget: warm the LLMs text cache using raw imports
              // void preloadLlmsText();
            }}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey && !promptProcessing) {
                e.preventDefault();
                handleSendPrompt();
              }
            }}
            className="border-light-decorative-00 dark:border-dark-decorative-00 text-light-primary dark:text-dark-primary bg-light-background-01 dark:bg-dark-background-01 focus:ring-accent-01-light dark:focus:ring-accent-01-dark max-h-[200px] min-h-[90px] w-full resize-y rounded-lg border p-2.5 text-sm focus:border-transparent focus:ring-2 focus:outline-none"
            placeholder={promptProcessing ? "Continue coding..." : "I want to build..."}
            rows={2}
          />
          <div className="flex items-center justify-between gap-2">
            {showModelPickerInChat && Array.isArray(models) && models.length > 0 && onModelChange ? (
              <ModelPicker
                currentModel={currentModel}
                onModelChange={onModelChange}
                models={models}
                // globalModel={globalModel}
                compact={isCompact}
              />
            ) : (
              <span aria-hidden="true" />
            )}
            <Button
              ref={submitButtonRef}
              type="button"
              onClick={handleSendPrompt}
              disabled={promptProcessing}
              variant="blue"
              size="fixed"
              aria-label={promptProcessing ? "Generating" : "Send message"}
            >
              {promptProcessing ? "•••" : "Code"}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = "ChatInput";

export default ChatInput;

// Temporarily disable memo to fix globalModel prop updates
