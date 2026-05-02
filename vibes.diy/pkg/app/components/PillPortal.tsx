import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { VibesSwitch } from "@vibes.diy/base";

/** Width reserved in headers/layouts so content clears the fixed pill. */
export const PILL_CLEARANCE = 125;

/** Height reserved below the pill for vertical clearance. */
export const PILL_CLEARANCE_Y = 60;

interface PillPortalProps {
  isActive: boolean;
  onToggle: (active: boolean) => void;
  mobilePreviewShown?: boolean;
}

export function PillPortal({ isActive, onToggle, mobilePreviewShown = false }: PillPortalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div
      className={mobilePreviewShown ? "hidden md:block" : ""}
      style={{
        position: "fixed",
        top: -9,
        left: 4,
        zIndex: 40,
      }}
    >
      <VibesSwitch size={75} isActive={isActive} onToggle={onToggle} className="cursor-pointer" />
    </div>,
    document.body
  );
}
