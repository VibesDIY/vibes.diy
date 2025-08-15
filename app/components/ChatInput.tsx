import type { ChangeEvent, KeyboardEvent } from 'react';
import { useEffect, memo, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import type { ChatState } from '../types/chat';
import ModelPicker, { type ModelOption } from './ModelPicker';
import { preloadLlmsText } from '../prompts';

interface ChatInputProps {
  chatState: ChatState;
  onSend: () => void;
  // Optional model picker props (for backward compatibility in tests/stories)
  currentModel?: string;
  onModelChange?: (modelId: string) => void | Promise<void>;
  models?: ModelOption[];
}

export interface ChatInputRef {
  clickSubmit: () => void;
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  ({ chatState, onSend, currentModel, onModelChange, models }, ref) => {
    // Ref for the submit button
    const submitButtonRef = useRef<HTMLButtonElement>(null);

    // Expose the click function to parent components
    useImperativeHandle(ref, () => ({
      clickSubmit: () => {
        if (submitButtonRef.current) {
          submitButtonRef.current.click();
        }
      },
    }));

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
        textarea.style.height = 'auto';
        const maxHeight = 200;
        const minHeight = 90;
        textarea.style.height = `${Math.max(minHeight, Math.min(maxHeight, textarea.scrollHeight))}px`;
      }
    }, [chatState.inputRef]);

    // Initial auto-resize
    useEffect(() => {
      autoResizeTextarea();
    }, [chatState.input, autoResizeTextarea]);

    return (
      <div className="px-4 py-2">
        <div className="space-y-1">
          <textarea
            ref={chatState.inputRef}
            value={chatState.input}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              if (chatState.setInput) {
                chatState.setInput(e.target.value);
              }
            }}
            onFocus={() => {
              // Fire and forget: warm the LLMs text cache using raw imports
              void preloadLlmsText();
            }}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey && !chatState.isStreaming) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="border-light-decorative-00 dark:border-dark-decorative-00 text-light-primary dark:text-dark-primary bg-light-background-01 dark:bg-dark-background-01 focus:ring-accent-01-light dark:focus:ring-accent-01-dark max-h-[200px] min-h-[90px] w-full resize-y rounded-lg border p-2.5 text-sm focus:border-transparent focus:ring-2 focus:outline-none"
            placeholder={
              chatState.docs.length || chatState.isStreaming
                ? 'Continue coding...'
                : 'I want to build...'
            }
            rows={2}
          />
          <div className="flex items-center justify-between gap-2">
            {models && onModelChange ? (
              <ModelPicker
                currentModel={currentModel}
                onModelChange={onModelChange}
                models={models}
              />
            ) : (
              <span aria-hidden="true" />
            )}
            <button
              ref={submitButtonRef}
              type="button"
              onClick={handleSendMessage}
              disabled={chatState.isStreaming}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              aria-label={chatState.isStreaming ? 'Generating' : 'Send message'}
            >
              {chatState.isStreaming ? '•••' : 'Code'}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';

// Use memo to optimize rendering
export default memo(ChatInput);
