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
  // Section-stream health — mirrors ChatInput's prop. "reconnecting" keeps the
  // button gated and swaps the label so the busy treatment matches the textarea.
  connectionState: "live" | "reconnecting" | "failed";
  hasCode: boolean;
  currentMsgCount: number;
  onSend: () => void;
  buttonRef: React.Ref<HTMLButtonElement>;
}

const btnSnakeBorder =
  "conic-gradient(from var(--border-angle, 0deg), var(--vibes-input-border, #d4d4d8) 0deg 180deg, var(--vibes-red, #DA291C) 180deg 205deg, var(--vibes-yellow, #fedd00) 205deg 230deg, var(--vibes-green, #22c55e) 230deg 255deg, var(--vibes-blue, #3b82f6) 255deg 280deg, var(--vibes-input-border, #d4d4d8) 280deg 360deg)";

/**
 * The streaming-driven half of the chat composer: the send button and its
 * "working…" label. Split out and memoized so that (a) the per-keystroke
 * re-render of ChatInput's textarea does not also re-render the button
 * subtree, and (b) the per-block "working…" label updates are localized
 * here. (Note: ChatInput's shell is not memoized, so the textarea itself
 * still reconciles on parent re-renders — that reconcile commits no DOM
 * changes and is cheap.)
 */
function ChatInputStatusImpl({
  promptProcessing,
  connectionState,
  hasCode,
  currentMsgCount,
  onSend,
  buttonRef,
}: ChatInputStatusProps) {
  const busy = promptProcessing || connectionState === "reconnecting";
  const workingMessage = connectionState === "reconnecting" ? "Reconnecting..." : getWorkingMessage(hasCode, currentMsgCount);
  return (
    <div
      style={{
        display: "inline-flex",
        borderRadius: 7,
        padding: busy ? 2 : 0,
        background: busy ? btnSnakeBorder : "transparent",
        animation: busy ? "vibes-border-spin 2s linear infinite" : "none",
      }}
    >
      <Button
        ref={buttonRef}
        type="button"
        onClick={onSend}
        disabled={busy}
        variant="blue"
        size="fixed"
        aria-label={busy ? "Processing" : "Send message"}
        className={
          busy ? "!border-0 !shadow-none !bg-[var(--vibes-submit-disabled-bg)] !text-[var(--vibes-submit-disabled-fg)]" : ""
        }
        style={busy ? { opacity: 1 } : undefined}
      >
        {busy ? (
          workingMessage
        ) : (
          <span aria-hidden="true" className="text-lg leading-none">
            ↑
          </span>
        )}
      </Button>
    </div>
  );
}

export const ChatInputStatus = React.memo(ChatInputStatusImpl);
export default ChatInputStatus;
