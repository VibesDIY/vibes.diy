import React from "react";
import { Button } from "./ui/button.js";

function getWorkingMessage(hasCode: boolean, msgCount: number): string {
  if (!hasCode && msgCount === 0) return "Thinking about your vibe...";
  if (!hasCode && msgCount > 0) return "Planning your app...";
  if (hasCode && msgCount < 20) return "Writing code...";
  if (hasCode && msgCount < 50) return "Building components...";
  return "Finishing up...";
}

interface ChatInputStatusProps {
  promptProcessing: boolean;
  hasCode: boolean;
  currentMsgCount: number;
  onSend: () => void;
  buttonRef: React.Ref<HTMLButtonElement>;
}

const btnSnakeBorder =
  "conic-gradient(from var(--border-angle, 0deg), var(--vibes-input-border, #d4d4d8) 0deg 180deg, var(--vibes-red, #DA291C) 180deg 205deg, var(--vibes-yellow, #fedd00) 205deg 230deg, var(--vibes-green, #22c55e) 230deg 255deg, var(--vibes-blue, #3b82f6) 255deg 280deg, var(--vibes-input-border, #d4d4d8) 280deg 360deg)";

/**
 * The streaming-driven half of the chat composer: the send button and its
 * "working…" label. Split out of ChatInput and memoized so per-block prop
 * churn (currentMsgCount/hasCode) re-renders only this small subtree, not the
 * textarea the user is typing into.
 */
function ChatInputStatusImpl({ promptProcessing, hasCode, currentMsgCount, onSend, buttonRef }: ChatInputStatusProps) {
  const workingMessage = getWorkingMessage(hasCode, currentMsgCount);
  return (
    <div
      style={{
        display: "inline-flex",
        borderRadius: 7,
        padding: promptProcessing ? 2 : 0,
        background: promptProcessing ? btnSnakeBorder : "transparent",
        animation: promptProcessing ? "vibes-border-spin 2s linear infinite" : "none",
      }}
    >
      <Button
        ref={buttonRef}
        type="button"
        onClick={onSend}
        disabled={promptProcessing}
        variant="blue"
        size="fixed"
        aria-label={promptProcessing ? "Processing" : "Send message"}
        className={
          promptProcessing
            ? "!border-0 !shadow-none !bg-[var(--vibes-submit-disabled-bg)] !text-[var(--vibes-submit-disabled-fg)]"
            : ""
        }
        style={promptProcessing ? { opacity: 1 } : undefined}
      >
        {promptProcessing ? workingMessage : "Code"}
      </Button>
    </div>
  );
}

export const ChatInputStatus = React.memo(ChatInputStatusImpl);
export default ChatInputStatus;
