import React, { useCallback, useEffect, useRef, useState } from "react";
import { buildAgentInstructions } from "./agent-instructions.js";

/**
 * "Copy instructions for your coding agent" affordance on the vibe editor's Code
 * tab. Copies a ready-to-paste markdown brief (see buildAgentInstructions) that
 * walks a coding harness through pull → edit → push for THIS vibe.
 *
 * Shown to everyone who can open the Code tab — pulling source works for anyone
 * with access to the vibe, not just the owner — so it renders independently of
 * the owner-only Edit toggle. Requires a resolved owner/slug (the caller gates on
 * that) so the copied commands always name a real vibe.
 */
export function CopyAgentInstructionsButton({
  ownerHandle,
  appSlug,
  title,
}: {
  ownerHandle: string;
  appSlug: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  // Clear the "Copied" flash without leaking a timer across unmounts.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = useCallback(() => {
    const md = buildAgentInstructions({ ownerHandle, appSlug, title });
    void navigator.clipboard
      .writeText(md)
      .then(() => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // Clipboard blocked (permissions / insecure context): stay silent rather
        // than throw — the button simply doesn't flash "Copied".
      });
  }, [ownerHandle, appSlug, title]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy a ready-to-paste brief for Claude Code, Cursor, or any coding agent"
      aria-label="Copy instructions for your coding agent"
      className="rounded px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-900/40"
    >
      {copied ? "Copied" : "Copy agent instructions"}
    </button>
  );
}
