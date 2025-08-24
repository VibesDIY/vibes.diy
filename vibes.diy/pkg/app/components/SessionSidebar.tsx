import React, { memo, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.js";
import { trackAuthClick } from "../utils/analytics.js";
import type { SessionSidebarProps } from "../types/chat.js";
import { GearIcon } from "./SessionSidebar/GearIcon.js";
import { HomeIcon } from "./SessionSidebar/HomeIcon.js";
import { InfoIcon } from "./SessionSidebar/InfoIcon.js";
import { StarIcon } from "./SessionSidebar/StarIcon.js";
import { FirehoseIcon } from "./SessionSidebar/FirehoseIcon.js";
import VibesDIYLogo, { randomColorway } from "./VibesDIYLogo.js";
import { dark, light } from "./colorways.js";

/**
 * Component that displays a navigation sidebar with menu items
 */
function SessionSidebar({ isVisible, onClose }: SessionSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  // Use CSS-based dark mode detection like the rest of the UI
  const isDarkMode =
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true; // Default to dark mode for SSR

  const colorway = randomColorway();
  const rando = isDarkMode ? dark[colorway] : light[colorway];

  // Handle clicks outside the sidebar to close it
  useEffect(() => {
    if (!isVisible) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    // Add event listener
    document.addEventListener("mousedown", handleClickOutside);

    // Clean up event listener
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isVisible, onClose]);

  // Conditionally render content but keep animation classes
  return (
    <div
      ref={sidebarRef}
      data-testid="session-sidebar"
      className={`bg-light-background-00 dark:bg-dark-background-00 fixed top-0 left-0 z-10 h-full shadow-lg transition-all duration-300 ${
        isVisible ? "w-64 translate-x-0" : "w-64 -translate-x-full"
      }`}
    >
      <div className="flex h-full flex-col overflow-auto">
        <div className="border-light-decorative-01 dark:border-dark-decorative-00 flex items-center justify-between border-b p-4">
          <VibesDIYLogo
            width={100}
            className="pointer-events-none -mt-18 -mb-20 -ml-2"
          />

          <button
            type="button"
            onClick={onClose}
            className="text-light-primary dark:text-dark-primary hover:text-accent-02-light dark:hover:text-accent-02-dark"
            aria-label="Close sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <nav className="flex-grow p-2">
          <ul className="space-y-1">
            <li>
              <a
                href="/"
                className="hover:bg-light-background-01 dark:hover:bg-dark-background-01 flex items-center rounded-md px-4 py-3 text-sm font-medium"
              >
                <HomeIcon className="text-accent-01 mr-3 h-5 w-5" />
                <span>Home</span>
              </a>
            </li>
            <li>
              <Link
                to="/vibes/mine"
                onClick={() => onClose()}
                className="hover:bg-light-background-01 dark:hover:bg-dark-background-01 flex items-center rounded-md px-4 py-3 text-sm font-medium"
              >
                <StarIcon className="text-accent-01 mr-3 h-5 w-5" />
                <span>My Vibes</span>
              </Link>
            </li>
            <li>
              <Link
                to="/firehose"
                onClick={() => onClose()}
                className="hover:bg-light-background-01 dark:hover:bg-dark-background-01 flex items-center rounded-md px-4 py-3 text-sm font-medium"
              >
                <FirehoseIcon className="text-accent-01 mr-3 h-5 w-5" />
                <span>Firehose</span>
              </Link>
            </li>
            <li>
              {isAuthenticated ? (
                // SETTINGS
                <Link
                  to="/settings"
                  onClick={() => onClose()}
                  className="hover:bg-light-background-01 dark:hover:bg-dark-background-01 flex items-center rounded-md px-4 py-3 text-sm font-medium"
                >
                  <GearIcon className="text-accent-01 mr-3 h-5 w-5" />
                  <span>Settings</span>
                </Link>
              ) : null}
            </li>
            <li>
              <Link
                to="/about"
                onClick={() => onClose()}
                className="hover:bg-light-background-01 dark:hover:bg-dark-background-01 flex items-center rounded-md px-4 py-3 text-sm font-medium"
              >
                <InfoIcon className="text-accent-01 mr-3 h-5 w-5" />
                <span>About</span>
              </Link>
            </li>
          </ul>
        </nav>

        {/* Login Status Indicator */}
        <div className="mt-auto">
          <nav className="flex-grow p-2">
            <ul className="space-y-1">
              {isLoading ? (
                // LOADING
                <li className="flex items-center rounded-md px-4 py-3 text-sm font-medium text-gray-400">
                  <span className="animate-pulse">Loading...</span>
                </li>
              ) : isAuthenticated ? null : (
                <>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        trackAuthClick({
                          label: "Sidebar Login",
                          isUserAuthenticated: false,
                        });
                        navigate("/login");
                        onClose();
                      }}
                      style={{
                        backgroundColor: rando.diy,
                      }}
                      className={`flex w-full items-center rounded-md px-4 py-3 text-left text-sm font-bold transition-colors`}
                    >
                      <span
                        style={{
                          color: rando.diyText,
                        }}
                      >
                        Log in
                      </span>
                    </button>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}

// Export a memoized version of the component to prevent unnecessary re-renders
export default memo(SessionSidebar, (prevProps, nextProps) => {
  // Only re-render if isVisible changes
  // Note: Functions should be memoized by parent components
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.onClose === nextProps.onClose
  );
});
