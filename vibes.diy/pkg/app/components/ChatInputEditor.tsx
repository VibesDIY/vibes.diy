import type { ChangeEvent, KeyboardEvent } from "react";
import React, { useCallback, useRef, forwardRef, useImperativeHandle, useState } from "react";
import type { ChatInputRef } from "./ChatInput.js";

interface ChatInputEditorProps {
  promptProcessing: boolean;
  onSubmit: (prompt: string) => void;
}

const ChatInputEditor = forwardRef<ChatInputRef, ChatInputEditorProps>(
  ({ promptProcessing, onSubmit }, ref) => {
    const submitButtonRef = useRef<HTMLButtonElement>(null);
    const realTextArea = useRef<HTMLTextAreaElement>(null);
    const [prompt, setPrompt] = useState<string | null>();

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

    const handleSendPrompt = useCallback(() => {
      if (prompt && !promptProcessing) {
        onSubmit(prompt);
        setPrompt("");
      }
    }, [prompt, promptProcessing, onSubmit]);

    return (
      <div className="vibes-composer-box">
        <div className="vibes-composer-inner">
          <textarea
            ref={realTextArea}
            value={prompt ?? ""}
            disabled={promptProcessing}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              setPrompt(e.target.value);
            }}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey && !promptProcessing) {
                e.preventDefault();
                handleSendPrompt();
              }
            }}
            className="vibes-chat-input"
            placeholder={promptProcessing ? "Continue coding..." : "Describe changes to your app..."}
            rows={1}
          />
          <div className="vibes-chat-btn-spacer" />
          <button
            ref={submitButtonRef}
            type="button"
            onClick={handleSendPrompt}
            disabled={promptProcessing}
            className="vibes-chat-send"
            aria-label={promptProcessing ? "Generating" : "Send message"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    );
  }
);

ChatInputEditor.displayName = "ChatInputEditor";

export default ChatInputEditor;
