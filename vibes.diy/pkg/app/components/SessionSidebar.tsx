import React, { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { SignIn, useAuth, useClerk, useUser } from "@clerk/react";
import type { SessionSidebarProps } from "@vibes.diy/prompts";
import { GearIcon } from "./SessionSidebar/GearIcon.js";
import { RecentVibes } from "./RecentVibes.js";

function SessionSidebar({ isVisible, onClose }: SessionSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { isSignedIn: isAuthenticated, isLoaded } = useAuth();
  const isLoading = !isLoaded;
  const clerk = useClerk();
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const [showSignIn, setShowSignIn] = useState(false);

  // Handle clicks outside the sidebar to close it
  useEffect(() => {
    if (!isVisible) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("[data-new-vibe-btn]")) return;
      if (sidebarRef.current && !sidebarRef.current.contains(target)) {
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
      <div className="flex h-full flex-col overflow-hidden pt-16">
        <nav className="flex-1 overflow-y-auto min-h-0 p-4">
          <RecentVibes onNavigate={onClose} />
        </nav>

        {/* Bottom section — pinned */}
        <div className="shrink-0 pb-6 px-4 space-y-3">
          {isAuthenticated && (
            <Link
              to="/settings"
              onClick={() => onClose()}
              className="flex items-center px-4 py-3 text-sm font-medium tracking-wide transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/10 border-t border-black/10 dark:border-white/10"
            >
              <GearIcon className="text-accent-01 mr-3 h-5 w-5" />
              <span>Settings</span>
            </Link>
          )}
          <nav>
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
                    className="bg-light-decorative-02 dark:bg-dark-decorative-01 text-white dark:text-dark-primary flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold tracking-wide border-2 border-[var(--vibes-border-primary)] transition-colors duration-150 hover:bg-black/20"
                  >
                    <span>Logout {userEmail}</span>
                  </button>
                </li>
              ) : (
                <li>
                  <button
                    type="button"
                    onClick={() => setShowSignIn(true)}
                    className="bg-light-decorative-02 dark:bg-dark-decorative-01 text-white dark:text-dark-primary flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold tracking-wide border-2 border-[var(--vibes-border-primary)] transition-colors duration-150 hover:bg-black/20"
                  >
                    <span>Log in</span>
                  </button>
                </li>
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
