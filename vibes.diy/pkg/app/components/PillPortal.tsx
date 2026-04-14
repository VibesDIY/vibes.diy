import React from "react";
import { createPortal } from "react-dom";
import { VibesSwitch } from "@vibes.diy/base";

/** Width reserved in headers/layouts so content clears the fixed pill. */
export const PILL_CLEARANCE = 125;

interface PillPortalProps {
  isActive: boolean;
  onToggle: (active: boolean) => void;
}

export function PillPortal({ isActive, onToggle }: PillPortalProps) {
  return createPortal(
    <div style={{ position: "fixed", top: -9, left: 4, zIndex: 950 }}>
      <VibesSwitch size={75} isActive={isActive} onToggle={onToggle} className="cursor-pointer" />
    </div>,
    document.body
  );
}
