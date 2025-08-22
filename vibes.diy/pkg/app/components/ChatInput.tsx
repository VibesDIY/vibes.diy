import type { ChangeEvent, KeyboardEvent } from "react";
import React, {
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import type { ChatState } from "../types/chat.js";
import ModelPicker, { type ModelOption } from "./ModelPicker.js";
import ImagePreview from "./ImagePreview.js";
import { preloadLlmsText } from "../prompts.js";

interface ChatInputProps {
  chatState: ChatState;
  onSend: () => void;
  // Optional model picker props (for backward compatibility in tests/stories)
  currentModel?: string;
  onModelChange?: (modelId: string) => void | Promise<void>;
  models?: ModelOption[];
  globalModel?: string;
  showModelPickerInChat?: boolean;
}

export interface ChatInputRef extends HTMLTextAreaElement {
  clickSubmit: () => void;
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  (
    {
      chatState,
      onSend,
      currentModel,
      onModelChange,
      models,
      globalModel,
      showModelPickerInChat,
    },
    ref,
  ) => {
    // Refs
    const submitButtonRef = useRef<HTMLButtonElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // State for responsive behavior
    const [isCompact, setIsCompact] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Expose the click function to parent components
    useImperativeHandle(
      ref,
      () =>
        ({
          clickSubmit: () => {
            if (submitButtonRef.current) {
              submitButtonRef.current.click();
            }
          },
        }) as ChatInputRef,
    );

    // Internal callback to handle sending messages
    const handleSendMessage = useCallback(() => {
      if (chatState.sendMessage && !chatState.isStreaming) {
        chatState.sendMessage(chatState.input);
        onSend(); // Call onSend for side effects only
      }
    }, [chatState, onSend]);
    // Auto-resize textarea function
    const autoResizeTextarea = useCallback(() => {
      const textarea = chatState.inputRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        const maxHeight = 200;
        const minHeight = 90;
        textarea.style.height = `${Math.max(minHeight, Math.min(maxHeight, textarea.scrollHeight))}px`;
      }
    }, [chatState.inputRef]);

    // Initial auto-resize
    useEffect(() => {
      autoResizeTextarea();
    }, [chatState.input, autoResizeTextarea]);

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

    const handleFilesSelected = useCallback(
      async (files: FileList | null) => {
        if (!files || !chatState.attachImages) return;
        await chatState.attachImages(files);
      },
      [chatState.attachImages],
    );

    const onDropFiles = useCallback(
      async (e: React.DragEvent<HTMLTextAreaElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = e.dataTransfer?.files;
        if (files && chatState.attachImages) {
          await chatState.attachImages(files);
        }
      },
      [chatState.attachImages],
    );

    return (
      <div ref={containerRef} className="px-4 py-2">
        <div className="space-y-2">
          {/* Attached images preview */}
          {Array.isArray(chatState.attachedImages) &&
            chatState.attachedImages.length > 0 && (
              <ImagePreview
                images={chatState.attachedImages}
                onRemove={(id) => chatState.removeAttachedImage?.(id)}
              />
            )}

          <textarea
            ref={chatState.inputRef}
            value={chatState.input}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              if (chatState.setInput) {
                chatState.setInput(e.target.value);
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={onDropFiles}
            onFocus={() => {
              // Fire and forget: warm the LLMs text cache using raw imports
              void preloadLlmsText();
            }}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey && !chatState.isStreaming) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className={`border-light-decorative-00 dark:border-dark-decorative-00 text-light-primary dark:text-dark-primary bg-light-background-01 dark:bg-dark-background-01 focus:ring-accent-01-light dark:focus:ring-accent-01-dark max-h-[200px] min-h-[90px] w-full resize-y rounded-lg border p-2.5 text-sm focus:border-transparent focus:ring-2 focus:outline-none ${isDragging ? "ring-2 ring-blue-500" : ""}`}
            placeholder={
              chatState.docs.length || chatState.isStreaming
                ? "Continue coding..."
                : "I want to build..."
            }
            rows={2}
          />
          <div className="flex items-center justify-between gap-2">
            {showModelPickerInChat &&
            Array.isArray(models) &&
            models.length > 0 &&
            onModelChange ? (
              <ModelPicker
                currentModel={currentModel}
                onModelChange={onModelChange}
                models={models}
                globalModel={globalModel}
                compact={isCompact}
              />
            ) : (
              <span className="flex items-center gap-2" aria-hidden="true" />
            )}
            <div className="flex items-center gap-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleFilesSelected(e.target.files);
                  // Allow selecting the same file(s) consecutively
                  e.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                aria-label="Attach images"
                className="border-light-decorative-00 text-light-primary hover:bg-light-decorative-00/40 dark:border-dark-decorative-00 dark:text-dark-primary dark:hover:bg-dark-decorative-00/40 rounded-md border px-2 py-1 text-sm transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={chatState.isStreaming}
              >
                +
              </button>
              <button
                ref={submitButtonRef}
                type="button"
                onClick={handleSendMessage}
                disabled={chatState.isStreaming}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                aria-label={
                  chatState.isStreaming ? "Generating" : "Send message"
                }
              >
                {chatState.isStreaming ? "•••" : "Code"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

ChatInput.displayName = "ChatInput";

// Temporarily disable memo to fix globalModel prop updates
export default ChatInput;
