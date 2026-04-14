import { SignIn, useAuth, useClerk, useUser } from "@clerk/react";
import type { SessionSidebarProps } from "@vibes.diy/prompts";
import React, { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { DevBoxIcon } from "./SessionSidebar/DevBoxIcon.js";
import { GearIcon } from "./SessionSidebar/GearIcon.js";
import { HomeIcon } from "./SessionSidebar/HomeIcon.js";
import { InfoIcon } from "./SessionSidebar/InfoIcon.js";
import { RecentVibes } from "./SessionSidebar/RecentVibes.js";
import { StarIcon } from "./SessionSidebar/StarIcon.js";

/**
 * Component that displays a navigation sidebar with menu items
 */
function parseDevBoxContext(pathname: string): { userSlug: string; appSlug: string; fsId?: string } | null {
  const chat = pathname.match(/^\/chat\/([^/]+)\/([^/]+)(?:\/([^/]+))?/);
  if (chat) return { userSlug: chat[1], appSlug: chat[2], fsId: chat[3] };
  const vibe = pathname.match(/^\/vibe\/([^/]+)\/([^/]+)(?:\/([^/]+))?/);
  if (vibe) return { userSlug: vibe[1], appSlug: vibe[2], fsId: vibe[3] };
  return null;
}

function SessionSidebar({ isVisible, onClose }: SessionSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { isSignedIn: isAuthenticated, isLoaded } = useAuth();
  const { pathname } = useLocation();
  const devBox = parseDevBoxContext(pathname);
  const isLoading = !isLoaded;
  const clerk = useClerk();
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const [showSignIn, setShowSignIn] = useState(false);

  // Clerk doesn't have polling state like the old auth system
  const isPolling = false;
  const pollError = null;

  // Handle clicks outside the sidebar to close it
  useEffect(() => {
    if (!isVisible) return;

    function handleClickOutside(event: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
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
      <div className="flex h-full flex-col overflow-auto pt-32">
        <nav className="flex-grow p-4">
          <ul className="space-y-4">
            <li>
              <a
                href="/"
                className="flex items-center rounded-xl px-4 py-3 text-sm font-medium tracking-wide border-2 border-[var(--vibes-border-primary)] bg-[var(--vibes-card-bg)] shadow-[4px_5px_0_var(--vibes-shadow-color)] transition-all duration-150 ease-in-out hover:shadow-[2px_3px_0_var(--vibes-shadow-color)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[5px]"
              >
                <HomeIcon className="text-accent-01 mr-3 h-5 w-5" />
                <span>Home</span>
              </a>
            </li>
            {devBox && (
              <li>
                <Link
                  to={`/chat/${devBox.userSlug}/${devBox.appSlug}`}
                  onClick={() => onClose()}
                  className="flex items-center rounded-xl px-4 py-3 text-sm font-medium tracking-wide border-2 border-[var(--vibes-border-primary)] bg-[var(--vibes-card-bg)] shadow-[4px_5px_0_var(--vibes-shadow-color)] transition-all duration-150 ease-in-out hover:shadow-[2px_3px_0_var(--vibes-shadow-color)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[5px]"
                >
                  <DevBoxIcon className="text-accent-01 mr-3 h-5 w-5" />
                  <span className="flex flex-col min-w-0">
                    <span>DevBox</span>
                    <span className="text-xs font-normal truncate opacity-60">
                      {devBox.userSlug}/{devBox.appSlug}
                    </span>
                  </span>
                </Link>
              </li>
            )}
            <li>
              <RecentVibes onNavigate={onClose} />
            </li>
            <li>
              <Link
                to="/vibes/mine"
                onClick={() => onClose()}
                className="flex items-center rounded-xl px-4 py-3 text-sm font-medium tracking-wide border-2 border-[var(--vibes-border-primary)] bg-[var(--vibes-card-bg)] shadow-[4px_5px_0_var(--vibes-shadow-color)] transition-all duration-150 ease-in-out hover:shadow-[2px_3px_0_var(--vibes-shadow-color)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[5px]"
              >
                <StarIcon className="text-accent-01 mr-3 h-5 w-5" />
                <span>My Vibes</span>
              </Link>
            </li>
            <li>
              {isAuthenticated ? (
                // SETTINGS
                <Link
                  to="/settings"
                  onClick={() => onClose()}
                  className="flex items-center rounded-xl px-4 py-3 text-sm font-medium tracking-wide border-2 border-[var(--vibes-border-primary)] bg-[var(--vibes-card-bg)] shadow-[4px_5px_0_var(--vibes-shadow-color)] transition-all duration-150 ease-in-out hover:shadow-[2px_3px_0_var(--vibes-shadow-color)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[5px]"
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
                className="flex items-center rounded-xl px-4 py-3 text-sm font-medium tracking-wide border-2 border-[var(--vibes-border-primary)] bg-[var(--vibes-card-bg)] shadow-[4px_5px_0_var(--vibes-shadow-color)] transition-all duration-150 ease-in-out hover:shadow-[2px_3px_0_var(--vibes-shadow-color)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[5px]"
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
            <ul className="space-y-2">
              {isLoading ? (
                // LOADING
                <li className="flex items-center rounded-md px-4 py-3 text-sm font-medium text-gray-400">
                  <span className="animate-pulse">Loading...</span>
                </li>
              ) : isAuthenticated ? (
                // AUTHENTICATED - Show "Logout {email}"
                <li>
                  <button
                    type="button"
                    onClick={async () => {
                      await clerk.signOut();
                      onClose();
                    }}
                    className="bg-light-decorative-02 dark:bg-dark-decorative-01 text-white dark:text-dark-primary flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold tracking-wide border-2 border-[var(--vibes-border-primary)] shadow-[4px_5px_0_var(--vibes-shadow-color)] transition-all duration-150 ease-in-out hover:shadow-[2px_3px_0_var(--vibes-shadow-color)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[5px]"
                  >
                    <span>Logout {userEmail}</span>
                  </button>
                </li>
              ) : isPolling ? (
                <li>
                  <div className="flex flex-col gap-1 px-4 py-3 text-sm font-medium">
                    <span className="">Opening log in window...</span>
                    <span className="font-small text-xs italic">
                      Don't see it? Please check your browser for a blocked pop-up window
                    </span>
                  </div>
                </li>
              ) : (
                <>
                  <li>
                    <div className="flex flex-col px-1 py-1 text-sm font-medium">
                      {pollError && <span className="font-small text-xs text-gray-400 italic">{pollError}</span>}
                    </div>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setShowSignIn(true)}
                      className="bg-light-decorative-02 dark:bg-dark-decorative-01 text-white dark:text-dark-primary flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold tracking-wide border-2 border-[var(--vibes-border-primary)] shadow-[4px_5px_0_var(--vibes-shadow-color)] transition-all duration-150 ease-in-out hover:shadow-[2px_3px_0_var(--vibes-shadow-color)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[5px]"
                    >
                      <span>Log in</span>
                    </button>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </div>

      {showSignIn &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSignIn(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <SignIn routing="hash" forceRedirectUrl={window.location.href} />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

// Export a memoized version of the component to prevent unnecessary re-renders
export default memo(SessionSidebar, (prevProps, nextProps) => {
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.onClose === nextProps.onClose &&
    prevProps.sessionId === nextProps.sessionId
  );
});
