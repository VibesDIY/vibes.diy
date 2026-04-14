import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { VibesSwitch } from "@vibes.diy/base";
import { useAuth } from "@clerk/react";
import { Link } from "react-router-dom";

/** Width reserved in headers/layouts so content clears the fixed pill. */
export const PILL_CLEARANCE = 125;

/** Height reserved below the pill for vertical clearance. */
export const PILL_CLEARANCE_Y = 60;

interface PillPortalProps {
  isActive: boolean;
  onToggle: (active: boolean) => void;
}

export function PillPortal({ isActive, onToggle }: PillPortalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { isSignedIn } = useAuth();

  if (!mounted) return null;

  const showNewVibe = isActive && isSignedIn;
  return createPortal(
    <div
      style={{
        position: "fixed",
        top: -9,
        left: 4,
        width: 248,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <VibesSwitch size={75} isActive={isActive} onToggle={onToggle} className="cursor-pointer" />
      <Link
        to="/"
        aria-label="New vibe"
        data-new-vibe-btn
        className="hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        onClick={() => onToggle(false)}
        style={{
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 8,
          color: "var(--vibes-near-black, #1a1a1a)",
          marginTop: 28,
          marginRight: 14,
          display: "flex",
          opacity: showNewVibe ? 1 : 0,
          pointerEvents: showNewVibe ? "auto" : "none",
          transition: showNewVibe ? "opacity 0.3s ease 0.3s" : "opacity 0.15s ease",
        }}
      >
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </Link>
    </div>,
    document.body
  );
}
