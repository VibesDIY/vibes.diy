import React, { useEffect, useState } from "react";
import { VibesSwitch } from "./VibesSwitch.js";
import { OptionButtons } from "./OptionButtons.js";
import { ViewerTagView } from "./ViewerTagView.js";

export interface UnifiedVibeCardProps {
  appTitle: string;
  appSlug?: string;
  appIconUrl?: string;
  chips?: readonly string[];
  onSelectChip?: (chip: string) => void;
  onSubmitOther?: (text: string) => void;
  /** Reserved for the verb-collapse work (#2679); not yet wired to any behavior. */
  isOwner?: boolean;
  handleSlug?: string;
  handleAvatarUrl?: string;
  onHome?: () => void;
  onShare?: () => void;
  /** Ref attached to the Share nav button so an external popover (the ShareModal) can anchor to it. */
  shareButtonRef?: React.Ref<HTMLButtonElement>;
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
  // Initialize from `open` so a controlled open-on-mount shows instantly; the
  // grow-from-corner entrance only plays on a subsequent toggle (by design).
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
        <div style={{ position: "absolute", right: 14, bottom: 16, pointerEvents: "auto" }}>
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
              <div
                aria-hidden
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  flexShrink: 0,
                  overflow: "hidden",
                  background: "linear-gradient(160deg,#312e81,#4c1d95)",
                  border: "1px solid rgba(0,0,0,0.15)",
                }}
              >
                {props.appIconUrl && (
                  <img src={props.appIconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <strong className="text-sm">{appTitle}</strong>
                {appSlug && (
                  <div className="text-light-secondary dark:text-dark-secondary" style={{ fontSize: 12 }}>
                    {appSlug}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: "0 14px 12px", overflowY: "auto" }}>
              {props.chips && props.chips.length > 0 && (
                <OptionButtons
                  options={props.chips}
                  isFirst
                  onSelect={(o) => {
                    props.onSelectChip?.(o);
                    // Return false so OptionButtons clears the press and the chips stay
                    // clickable — until codegen is wired (#2677) a chip click is a fire-and-
                    // forget signal, not a one-shot commit, so we don't want it to lock.
                    return false;
                  }}
                />
              )}
              <OtherRow onSubmitOther={props.onSubmitOther} />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "10px 12px 12px",
                borderTop: "1px solid var(--color-light-decorative-00, #e5e5e5)",
              }}
            >
              {props.handleSlug ? (
                <ViewerTagView
                  slug={props.handleSlug}
                  displayName={`@${props.handleSlug}`}
                  avatarUrl={props.handleAvatarUrl}
                  trailing={<span style={{ fontSize: 11, opacity: 0.6, marginLeft: 1 }}>▾</span>}
                  style={{
                    background: "var(--color-light-background-01, #eee)",
                    border: "1px solid var(--color-light-decorative-01, #ddd)",
                    color: "var(--color-light-primary, #333)",
                    fontSize: 13,
                    padding: "3px 8px 3px 4px",
                  }}
                />
              ) : (
                <ViewerTagView slug="?" anonymous onSignIn={props.onSignIn} />
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <NavIcon label="Home" color="#3b82f6" onClick={props.onHome}>
                  ⌂
                </NavIcon>
                <NavIcon label="Chat" color="#fb923c" selected>
                  💬
                </NavIcon>
                <NavIcon label="Share" color="#22c55e" onClick={props.onShare} buttonRef={props.shareButtonRef}>
                  ↗
                </NavIcon>
              </div>
              <button
                type="button"
                aria-label="Close vibe menu"
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                <VibesSwitch size={38} isActive />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavIcon({
  label,
  color,
  selected,
  onClick,
  buttonRef,
  children,
}: {
  readonly label: string;
  readonly color: string;
  readonly selected?: boolean;
  readonly onClick?: () => void;
  readonly buttonRef?: React.Ref<HTMLButtonElement>;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: 16,
        cursor: "pointer",
        border: "1px solid var(--vibes-near-black, #1a1a1a)",
        boxShadow: selected ? "0 0 0 3px var(--vibes-near-black, #1a1a1a)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function OtherRow({ onSubmitOther }: { readonly onSubmitOther?: (text: string) => void }) {
  const [value, setValue] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const text = value.trim();
        if (text) onSubmitOther?.(text);
        setValue("");
      }}
      style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}
      className="rounded-md border border-light-decorative-01 dark:border-dark-decorative-01 px-3 py-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="describe a change…"
        className="flex-1 bg-transparent text-sm text-light-primary dark:text-dark-primary outline-none placeholder:text-light-secondary dark:placeholder:text-dark-secondary"
      />
      <button
        type="submit"
        aria-label="Submit change"
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
      >
        ▸
      </button>
    </form>
  );
}

export default UnifiedVibeCard;
