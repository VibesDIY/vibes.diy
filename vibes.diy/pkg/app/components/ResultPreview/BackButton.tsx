import { BackArrowIcon } from "../HeaderContent/SvgIcons.js";
import React from "react";

interface BackButtonProps {
  onBackClick: () => void;
}

export const BackButton: React.FC<BackButtonProps> = ({ onBackClick }) => {
  return (
    <div className="navbar-button-wrapper md:hidden">
      <button
        type="button"
        onClick={onBackClick}
        style={{ background: "var(--vibes-cream)" }}
        aria-label="Back to chat"
      >
        <div className="navbar-button-icon">
          <BackArrowIcon />
        </div>
        <div className="navbar-button-label" style={{ color: "var(--vibes-near-black)" }}>
          Back
        </div>
      </button>
    </div>
  );
};
