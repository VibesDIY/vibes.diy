import type { ChangeEvent, KeyboardEvent } from "react";
import React, { useEffect, useCallback, useRef, forwardRef, useImperativeHandle, useState } from "react";
import ModelPicker, { type ModelOption } from "./ModelPicker.js";
import { Button } from "./ui/button.js";
import { ChatInputStatus } from "./ChatInputStatus.js";
import type { VibesTheme } from "@vibes.diy/prompts";
import ThemeControls from "./ThemeControls.js";

interface ChatInputProps {
  promptProcessing: boolean;
  onSubmit: (prompt: string) => void;
  currentModel?: string;
  onModelChange?: (modelId: string) => void | Promise<void>;
  models?: ModelOption[];
  showModelPickerInChat?: boolean;
  hasCode?: boolean;
  currentMsgCount?: number;
  selectedTheme?: VibesTheme | null;
  onThemeButtonClick?: () => void;
  // Palette picker — separate from the structural theme picker because
  // swapping the palette is a no-LLM, instant-apply action. The picker
  // owns its draft state (the currently-shown palette + per-token edits)
  // and emits two signals: onSelectPalette persists a slug choice;
  // onApplyLive pushes the composed colors to the iframe without saving.
  paletteOptions?: VibesTheme[];
  selectedPaletteSlug?: string;
  onSelectPalette?: (slug: string) => void;
  onApplyLivePalette?: (colors: Record<string, string>, colorsDark?: Record<string, string>) => void;
  onResetPalette?: () => void;
  onRegeneratePalette?: (paletteSlug: string, paletteName: string, rootCssBlock: string) => void;
  // localStorage key for persisting palette edits per app. Threaded straight
  // to ColorsetPicker — see its `storageKey` prop for semantics.
  paletteStorageKey?: string;
  // Tokens the running app's `:root` actually declares, streamed from the
  // sandbox runtime. Lets the modal show + edit + remap every custom
  // property the app has, including bespoke ones outside the canonical set.
  paletteCurrentTokens?: Record<string, string>;
  // Section-stream health from the chat route. "reconnecting" keeps the
  // submit path gated and swaps the working label; "failed" renders the
  // reload affordance so the UI is never permanently stuck.
  connectionState?: "live" | "reconnecting" | "failed";
}

export interface ChatInputRef extends HTMLTextAreaElement {
  clickSubmit: () => void;
  setFocus: () => void;
  setPrompt: (p: string) => void;
  /** Set the textarea content only if it's currently empty. Used by the
   * theme picker to prefill a default "Please update the theme" prompt
   * without clobbering whatever the user had been typing. Returns true
   * if the textarea was empty and got set, false if a draft was kept. */
  setPromptIfEmpty: (p: string) => boolean;
  setSelection: (start: number, end: number) => void;
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
      selectedTheme,
      onThemeButtonClick,
      paletteOptions,
      selectedPaletteSlug,
      onSelectPalette,
      onApplyLivePalette,
      onResetPalette,
      onRegeneratePalette,
      paletteStorageKey,
      paletteCurrentTokens,
      connectionState = "live",
    },
    ref
  ) => {
    const submitButtonRef = useRef<HTMLButtonElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [prompt, setPrompt] = useState<string | null>();
    const [isCompact, setIsCompact] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const realTextArea = useRef<HTMLTextAreaElement>(null);

    const busy = promptProcessing || connectionState === "reconnecting";

    // Track latest values in refs so handleSendPrompt can stay identity-stable
    // across keystrokes (its deps no longer include prompt/busy), which lets
    // ChatInputStatus's React.memo actually hold.
    const promptRef = useRef(prompt);
    promptRef.current = prompt;
    const busyRef = useRef(busy);
    busyRef.current = busy;

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
          setPromptIfEmpty: (v) => {
            if (prompt) return false;
            setPrompt(v);
            return true;
          },
          setSelection: (s, e) => {
            if (realTextArea.current) {
              realTextArea.current.selectionStart = s;
              realTextArea.current.selectionEnd = e;
            }
          },
          clickSubmit: () => {
            submitButtonRef.current?.click();
          },
        }) as ChatInputRef
    );

    const handleSendPrompt = useCallback(() => {
      const p = promptRef.current;
      if (p && !busyRef.current) {
        onSubmit(p);
        setPrompt("");
      }
    }, [onSubmit]);

    // Tracks the textarea's value length across resizes so we only pay the
    // "reset to auto" reflow when the text could have gotten shorter — the one
    // case where scrollHeight needs a reset to report a smaller height.
    const lastValueLengthRef = useRef(0);
    const autoResizeTextarea = useCallback(() => {
      const el = realTextArea.current;
      if (!el) return;
      const maxHeight = 200;
      const minHeight = 90;
      const len = el.value.length;
      const couldShrink = len < lastValueLengthRef.current;
      lastValueLengthRef.current = len;
      // When growing or unchanged, scrollHeight already reflects the content,
      // so el.style.height still holds the prior explicit height — the guard
      // below then genuinely skips the write on a no-op resize. Only the shrink
      // path resets to "auto" (making the compare against "auto" intentional).
      if (couldShrink) el.style.height = "auto";
      const next = `${Math.max(minHeight, Math.min(maxHeight, el.scrollHeight))}px`;
      if (el.style.height !== next) el.style.height = next;
    }, []);

    useEffect(() => {
      autoResizeTextarea();
    }, [prompt, autoResizeTextarea]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) setIsCompact(entry.contentRect.width < 400);
      });
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }, []);

    const borderColor = "var(--vibes-input-border, #d4d4d8)";
    const neutralBorder = `linear-gradient(${borderColor}, ${borderColor})`;
    const focusBottomBar =
      "linear-gradient(90deg, var(--vibes-red, #DA291C) 0% 25%, var(--vibes-yellow, #fedd00) 25% 50%, var(--vibes-green, #22c55e) 50% 75%, var(--vibes-blue, #3b82f6) 75% 100%)";
    const innerBg = "linear-gradient(var(--chat-input-bg), var(--chat-input-bg))";

    // Two states: focused (color bar at bottom), idle (neutral) — no animation on textarea
    const borderBackground = isFocused
      ? `${innerBg} padding-box, ${focusBottomBar} center bottom / 100% 3px no-repeat border-box, ${neutralBorder} border-box`
      : `${innerBg} padding-box, ${neutralBorder} border-box`;

    return (
      <div ref={containerRef} className="px-2 py-1">
        <div className="space-y-1">
          {connectionState === "failed" && (
            <div className="flex items-center justify-between gap-2 rounded border border-light-decorative-01 dark:border-dark-decorative-01 px-2 py-1.5 text-xs text-light-secondary dark:text-dark-secondary">
              <span>Connection lost — your app may have finished building.</span>
              <Button type="button" variant="blue" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </div>
          )}
          <ThemeControls
            selectedTheme={selectedTheme}
            onThemeButtonClick={onThemeButtonClick}
            paletteOptions={paletteOptions}
            selectedPaletteSlug={selectedPaletteSlug}
            onSelectPalette={onSelectPalette}
            onApplyLivePalette={onApplyLivePalette}
            onResetPalette={onResetPalette}
            onRegeneratePalette={onRegeneratePalette}
            paletteStorageKey={paletteStorageKey}
            paletteCurrentTokens={paletteCurrentTokens}
          />
          {/* Textarea — border is the color bar, animates when processing */}
          <div
            className="[--chat-input-bg:var(--color-light-background-01,#eee)] dark:[--chat-input-bg:var(--color-dark-background-01,#222)]"
            style={{
              position: "relative",
              borderRadius: 8,
              border: "3px solid transparent",
              background: borderBackground,
            }}
          >
            <textarea
              ref={realTextArea}
              value={prompt ?? ""}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                setPrompt(e.target.value);
              }}
              onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey && !busy) {
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
              onFocus={() => {
                setIsFocused(true);
              }}
              onBlur={() => {
                setIsFocused(false);
              }}
              placeholder="I want to build..."
              rows={2}
            />
          </div>

          {/* Bottom row: model picker + button (rainbow animation on button when processing) */}
          <div className="flex items-center justify-between gap-2">
            {showModelPickerInChat && Array.isArray(models) && models.length > 0 && onModelChange ? (
              <ModelPicker currentModel={currentModel} onModelChange={onModelChange} models={models} compact={isCompact} />
            ) : (
              <span aria-hidden="true" />
            )}
            <ChatInputStatus
              promptProcessing={promptProcessing}
              connectionState={connectionState}
              hasCode={hasCode}
              currentMsgCount={currentMsgCount}
              onSend={handleSendPrompt}
              buttonRef={submitButtonRef}
            />
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
        `}</style>
      </div>
    );
  }
);

ChatInput.displayName = "ChatInput";

export default ChatInput;
