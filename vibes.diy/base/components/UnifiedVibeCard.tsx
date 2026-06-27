import React, { useEffect, useState } from "react";
import { VibesSwitch } from "./VibesSwitch.js";

export interface UnifiedVibeCardProps {
  appTitle: string;
  appSlug?: string;
  appIconUrl?: string;
  chips?: readonly string[];
  onSelectChip?: (chip: string) => void;
  onSubmitOther?: (text: string) => void;
  isOwner?: boolean;
  handleSlug?: string;
  handleAvatarUrl?: string;
  onHome?: () => void;
  onShare?: () => void;
  onSignIn?: () => void;
  isTwinkling?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function UnifiedVibeCard(props: UnifiedVibeCardProps) {
  const { appTitle, appSlug, isTwinkling, open: controlledOpen, onOpenChange } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Animation: the OUTER card scales from the toggle's lower-right corner
  // (`grown`), and the inner content fades in only after the grow. `mounted`
  // keeps the card in the DOM through the shrink so the exit animates.
  const [mounted, setMounted] = useState(open);
  const [grown, setGrown] = useState(open);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (open) {
      setMounted(true);
      t = setTimeout(() => setGrown(true), 10);
    } else {
      setGrown(false);
      t = setTimeout(() => setMounted(false), 240);
    }
    return () => clearTimeout(t);
  }, [open]);

  return (
    <>
      {!mounted && (
        <div style={{ position: "absolute", right: 14, bottom: 16 }}>
          <button
            type="button"
            aria-label="Open vibe menu"
            onClick={() => setOpen(true)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <VibesSwitch size={48} isActive isTwinkling={isTwinkling} />
          </button>
        </div>
      )}

      {mounted && (
        <div
          role="dialog"
          aria-label="Vibe menu"
          className={props.className}
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            borderRadius: 16,
            maxHeight: "82%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            background: "var(--color-light-background-00, #fff)",
            border: "1px solid var(--vibes-near-black, #1a1a1a)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
            transformOrigin: "bottom right",
            transform: grown ? "scale(1)" : "scale(0)",
            transition: "transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1)",
            pointerEvents: grown ? "auto" : "none",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              opacity: grown ? 1 : 0,
              transition: grown ? "opacity 0.18s ease 0.14s" : "opacity 0.1s ease",
            }}
            className="text-light-primary dark:text-dark-primary"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 8px" }}>
              <div style={{ lineHeight: 1.2 }}>
                <strong className="text-sm">{appTitle}</strong>
                {appSlug && (
                  <div className="text-light-secondary dark:text-dark-secondary" style={{ fontSize: 12 }}>
                    {appSlug}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default UnifiedVibeCard;
