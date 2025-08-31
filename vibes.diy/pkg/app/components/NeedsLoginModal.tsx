import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.js";
import { trackAuthClick } from "../utils/analytics.js";

/**
 * A modal that appears when the user needs to login to get more credits
 * This listens for the needsLogin state from AuthContext and navigates to /login
 */
export function NeedsLoginModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { needsLogin } = useAuth();
  const navigate = useNavigate();

  // Show the modal when needsLogin becomes true or is already true
  useEffect(() => {
    if (needsLogin) {
      setIsOpen(true);
    }
  }, [needsLogin]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleLogin = async () => {
    trackAuthClick({
      label: "Get Credits Modal",
      isUserAuthenticated: false,
    });

    // Navigate to inline login page
    setIsOpen(false);
    navigate("/login");
  };

  if (!isOpen) return null;

  // Center the menu on screen
  const menuStyle = {
    position: "fixed" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 10000, // Ensure it's above everything else
  };

  const handleBackdropClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] m-0 bg-black/25"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          handleClose();
        }
      }}
      aria-label="Login required modal"
    >
      <div
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
        className="ring-opacity-5 dark:bg-dark-background-01 w-80 rounded-lg border-2 border-orange-200 bg-white p-6 shadow-xl ring-1 ring-black/20 dark:border-orange-700"
      >
        <div className="py-1" role="dialog" aria-labelledby="login-modal-title">
          <div className="mb-6">
            <h3
              id="login-modal-title"
              className="mb-3 text-center text-lg font-bold text-orange-500"
            >
              Log in for Credits
            </h3>
            <p className="text-light-secondary dark:text-dark-secondary text-sm leading-relaxed">
              Log in or create an account to continue generating creative apps
              with Vibes DIY.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogin}
            className="accent-01 block w-full rounded-md bg-orange-500 px-5 py-3 text-center text-sm font-medium text-white transition-colors duration-150 ease-in-out hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-600"
            role="menuitem"
          >
            <span className="w-full text-center font-bold">Login</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
