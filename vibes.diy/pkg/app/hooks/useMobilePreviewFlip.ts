import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { isCodeBegin } from "@vibes.diy/call-ai-v2";
import { isMobileViewport } from "../utils/ViewState.js";
import type { PromptState } from "../routes/chat/prompt-state.js";

export interface MobilePreviewFlipOpts {
  readonly promptState: PromptState;
  readonly inConstruction: boolean;
  readonly setMobilePreviewShown: Dispatch<SetStateAction<boolean>>;
}

/**
 * On mobile (chat and preview not visible simultaneously), stay on chat view
 * while the LLM is planning so the user can watch the explanation stream in,
 * then auto-flip to preview when the FIRST code block of the current stream
 * begins. Resets per running cycle so follow-up prompts also see the
 * chat→preview transition. Behavior-preserving extraction from the Chat
 * component (VibesDIY/vibes.diy#2015).
 */
export function useMobilePreviewFlip(opts: MobilePreviewFlipOpts): void {
  const { promptState, inConstruction, setMobilePreviewShown } = opts;
  const sawCodeBeginThisRunRef = useRef(false);
  useEffect(() => {
    if (inConstruction) return;
    if (!promptState.running) {
      sawCodeBeginThisRunRef.current = false;
      return;
    }
    if (sawCodeBeginThisRunRef.current) return;
    const last = promptState.blocks[promptState.blocks.length - 1];
    if (last === undefined) return;
    if (!last.msgs.some((m) => isCodeBegin(m))) return;
    sawCodeBeginThisRunRef.current = true;
    if (isMobileViewport()) {
      setMobilePreviewShown(true);
    }
  }, [promptState.running, promptState.blocks, inConstruction, setMobilePreviewShown]);
}
