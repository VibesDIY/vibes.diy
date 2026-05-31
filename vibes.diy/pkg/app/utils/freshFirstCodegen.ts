import { useEffect, useMemo, useState } from "react";
import { isCodeEnd } from "@vibes.diy/call-ai-v2";
import type { PromptState } from "../routes/chat/chat.$ownerHandle.$appSlug.js";

/**
 * Detect the "first codegen of a brand-new chat or remix" window — the slug
 * pair was mounted without an fsId in the URL, and no code-end has appeared
 * in the chat's blocks yet. Returns false for chats reloaded with an fsId,
 * or once the first code-end of this pinning has fired.
 *
 * The flag is keyed by `ownerHandle/appSlug` so cross-vibe navigation re-arms
 * the detection against the new URL.
 */
export function useFreshFirstCodegen(promptState: PromptState, fsId: string | undefined): boolean {
  const slugKey = `${promptState.chat.ownerHandle}/${promptState.chat.appSlug}`;
  const [keyedFresh, setKeyedFresh] = useState(() => ({ slugKey, fresh: fsId === undefined }));
  useEffect(() => {
    if (keyedFresh.slugKey !== slugKey) {
      setKeyedFresh({ slugKey, fresh: fsId === undefined });
    }
  }, [slugKey, fsId, keyedFresh.slugKey]);

  const firstCodeEndSeen = useMemo(() => {
    for (const block of promptState.blocks) {
      for (const msg of block.msgs) {
        if (isCodeEnd(msg)) return true;
      }
    }
    return false;
  }, [promptState.blocks]);

  return keyedFresh.fresh && !firstCodeEndSeen;
}
