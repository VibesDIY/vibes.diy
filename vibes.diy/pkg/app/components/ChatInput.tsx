import type { ChangeEvent, KeyboardEvent } from "react";
import React, { useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useState, useMemo } from "react";
import ModelPicker, { type ModelOption } from "./ModelPicker.js";
import { Button } from "./ui/button.js";

interface ChatInputProps {
  promptProcessing: boolean;
  onSubmit: (prompt: string) => void;
  currentModel?: string;
  onModelChange?: (modelId: string) => void | Promise<void>;
  models?: ModelOption[];
  showModelPickerInChat?: boolean;
  hasCode?: boolean;
  currentMsgCount?: number;
}

export interface ChatInputRef extends HTMLTextAreaElement {
  clickSubmit: () => void;
  setFocus: () => void;
  setPrompt: (p: string) => void;
  setSelection: (start: number, end: number) => void;
}

function getWorkingMessage(hasCode: boolean, msgCount: number): string {
  if (!hasCode && msgCount === 0) return "Thinking about your vibe...";
  if (!hasCode && msgCount > 0) return "Planning your app...";
  if (hasCode && msgCount < 20) return "Writing code...";
  if (hasCode && msgCount < 50) return "Building components...";
  return "Finishing up...";
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  (
    {
      promptProcessing,
      onSubmit,
      currentModel,
      onModelChange,
      models,
      showModelPickerInChat,
      hasCode = false,
      currentMsgCount = 0,
    },
    ref
  ) => {
    const submitButtonRef = useRef<HTMLButtonElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [prompt, setPrompt] = useState<string | null>();
    const [isCompact, setIsCompact] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const realTextArea = useRef<HTMLTextAreaElement>(null);

    const workingMessage = useMemo(
      () => getWorkingMessage(hasCode, currentMsgCount),
      [hasCode, currentMsgCount]
    );

    useImperativeHandle(
      ref,
      () =>
        ({
          setFocus: () => { realTextArea.current?.focus(); },
          setPrompt: (v) => { setPrompt(v); },
          setSelection: (s, e) => {
            if (realTextArea.current) {
              realTextArea.current.selectionStart = s;
              realTextArea.current.selectionEnd = e;
            }
          },
          clickSubmit: () => { submitButtonRef.current?.click(); },
        }) as ChatInputRef
    );

    const handleSendPrompt = useCallback(() => {
      if (prompt && !promptProcessing) {
        onSubmit(prompt);
      }
    }, [prompt, promptProcessing, onSubmit]);

    const autoResizeTextarea = useCallback(() => {
      if (realTextArea.current) {
        realTextArea.current.style.height = "auto";
        const maxHeight = 200;
        const minHeight = 90;
        realTextArea.current.style.height = `${Math.max(minHeight, Math.min(maxHeight, realTextArea.current.scrollHeight))}px`;
      }
    }, [ref]);

    useEffect(() => { autoResizeTextarea(); }, [prompt, autoResizeTextarea]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) setIsCompact(entry.contentRect.width < 400);
      });
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }, []);

    const borderColor = "#d4d4d8";
    // Snake: 4-color segment starts at bottom (~180deg), rest is neutral
    const snakeBorder = `conic-gradient(from var(--border-angle, 0deg), ${borderColor} 0deg 180deg, var(--vibes-red, #DA291C) 180deg 205deg, var(--vibes-yellow, #fedd00) 205deg 230deg, var(--vibes-green, #22c55e) 230deg 255deg, var(--vibes-blue, #3b82f6) 255deg 280deg, ${borderColor} 280deg 360deg)`;
    const neutralBorder = `linear-gradient(${borderColor}, ${borderColor})`;
    const focusBottomBar = "linear-gradient(90deg, var(--vibes-red, #DA291C) 0% 25%, var(--vibes-yellow, #fedd00) 25% 50%, var(--vibes-green, #22c55e) 50% 75%, var(--vibes-blue, #3b82f6) 75% 100%)";
    const innerBg = "linear-gradient(var(--chat-input-bg), var(--chat-input-bg))";

    // Three states: processing (snake), focused (color bar at bottom), idle (neutral)
    const borderBackground = promptProcessing
      ? `${innerBg} padding-box, ${snakeBorder} border-box`
      : isFocused
        ? `${innerBg} padding-box, ${focusBottomBar} center bottom / 100% 3px no-repeat border-box, ${neutralBorder} border-box`
        : `${innerBg} padding-box, ${neutralBorder} border-box`;

    return (
      <div ref={containerRef} className="px-2 py-1">
        <div className="space-y-1">
          {/* Textarea — border is the color bar, animates when processing */}
          <div
            className="[--chat-input-bg:var(--color-light-background-01,#eee)] dark:[--chat-input-bg:var(--color-dark-background-01,#222)]"
            style={{
              position: "relative",
              borderRadius: 8,
              border: "3px solid transparent",
              background: borderBackground,
              animation: promptProcessing ? "vibes-border-spin 3s linear infinite" : "none",
            }}
          >
            <textarea
              ref={realTextArea}
              value={prompt ?? ""}
              disabled={promptProcessing}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => { setPrompt(e.target.value); }}
              onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey && !promptProcessing) {
                  e.preventDefault();
                  handleSendPrompt();
                }
              }}
              className="text-light-primary dark:text-dark-primary bg-light-background-01 dark:bg-dark-background-01 max-h-[200px] min-h-[90px] w-full resize-y p-2.5 text-sm focus:outline-none focus:ring-0 focus:shadow-none"
              style={{
                outline: "none",
                boxShadow: "none",
                border: "none",
                borderRadius: 5,
              }}
              onFocus={() => { if (!promptProcessing) setIsFocused(true); }}
              onBlur={(e) => {
                // Don't remove focus border if clicking the Code button — prevents re-render that kills the click
                if (e.relatedTarget === submitButtonRef.current) return;
                setIsFocused(false);
              }}
              placeholder="I want to build..."
              rows={2}
            />
          </div>

          {/* Bottom row: model picker + button OR working message */}
          <div className="flex items-center justify-between gap-2">
            {promptProcessing ? (
              <div className="flex items-center gap-2 py-1">
                <div
                  className="border-light-primary dark:border-dark-primary shrink-0"
                  style={{
                    width: 16,
                    height: 16,
                    borderWidth: 3,
                    borderStyle: "solid",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "vibes-spin 0.8s linear infinite",
                  }}
                />
                <span className="text-light-primary dark:text-dark-primary text-xs font-semibold tracking-wide">
                  {workingMessage}
                </span>
              </div>
            ) : (
              <>
                {showModelPickerInChat && Array.isArray(models) && models.length > 0 && onModelChange ? (
                  <ModelPicker
                    currentModel={currentModel}
                    onModelChange={onModelChange}
                    models={models}
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
                  aria-label="Send message"
                >
                  Code
                </Button>
              </>
            )}
          </div>
        </div>

        <style>{`
          @property --border-angle {
            syntax: "<angle>";
            initial-value: 0deg;
            inherits: false;
          }
          @keyframes vibes-border-spin {
            to { --border-angle: 360deg; }
          }
          @keyframes vibes-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
);

ChatInput.displayName = "ChatInput";

export default ChatInput;
