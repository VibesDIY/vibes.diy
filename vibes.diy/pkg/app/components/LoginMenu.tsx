import { createPortal } from "react-dom";
import React from "react";
import { trackAuthClick } from "../utils/analytics.js";

interface LoginMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

export function LoginMenu({
  isOpen,
  onLogin,
  onClose,
  // buttonRef,
}: LoginMenuProps) {
  if (!isOpen) return null;

  // Center the menu on screen rather than positioning it relative to the button
  const menuStyle = {
    position: "fixed" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  };

  const handleBackdropClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] m-0 bg-black/25"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
      aria-label="User menu"
    >
      <div
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
        className="ring-opacity-5 dark:bg-dark-background-01 w-80 rounded-lg border-2 border-orange-200 bg-white p-6 shadow-xl ring-1 ring-black/20 dark:border-orange-700"
      >
        <div
          className="py-1"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="login-menu"
        >
          <div className="mb-6">
            <h3 className="mb-3 text-center text-lg font-bold text-orange-500">
              Log in for Credits
            </h3>
            <p className="text-light-secondary dark:text-dark-secondary text-sm leading-relaxed">
              Log in or create an account to continue generating creative apps
              with Vibes DIY.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              trackAuthClick();
              onLogin();
            }}
            className="accent-01 block w-full rounded-md bg-orange-500 px-5 py-3 text-center text-sm font-medium text-white transition-colors duration-150 ease-in-out hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-600"
            role="menuitem"
          >
            <span className="w-full text-center font-bold">Log in</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
