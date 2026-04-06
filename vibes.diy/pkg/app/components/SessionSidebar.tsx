import React, { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { SignIn, useAuth, useClerk, useUser } from "@clerk/react";
import type { SessionSidebarProps } from "@vibes.diy/prompts";
import { GearIcon } from "./SessionSidebar/GearIcon.js";
import { HomeIcon } from "./SessionSidebar/HomeIcon.js";
import { InfoIcon } from "./SessionSidebar/InfoIcon.js";
import { StarIcon } from "./SessionSidebar/StarIcon.js";
import { DevBoxIcon } from "./SessionSidebar/DevBoxIcon.js";

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

  const isPolling = false;
  const pollError = null;

  useEffect(() => {
    if (!isVisible) return;

    function handleClickOutside(event: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isVisible, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`vibes-sidebar-overlay ${isVisible ? "active" : ""}`}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div
        ref={sidebarRef}
        data-testid="session-sidebar"
        className={`vibes-sidebar ${isVisible ? "active" : ""}`}
      >
        <div className="vibes-sidebar-inner">
          <nav className="vibes-sidebar-nav">
            <ul className="vibes-sidebar-list">
              <li>
                <a href="/" className="vibes-sidebar-card">
                  <HomeIcon className="vibes-sidebar-icon icon-home" />
                  <span>Home</span>
                </a>
              </li>
              {devBox && (
                <li>
                  <Link
                    to={`/chat/${devBox.userSlug}/${devBox.appSlug}`}
                    onClick={() => onClose()}
                    className="vibes-sidebar-card"
                  >
                    <DevBoxIcon className="vibes-sidebar-icon icon-devbox" />
                    <span className="vibes-sidebar-card-col">
                      <span>DevBox</span>
                      <span className="vibes-sidebar-card-meta">
                        {devBox.userSlug}/{devBox.appSlug}
                      </span>
                    </span>
                  </Link>
                </li>
              )}
              <li>
                <Link to="/vibes/mine" onClick={() => onClose()} className="vibes-sidebar-card">
                  <StarIcon className="vibes-sidebar-icon icon-vibes" />
                  <span>My Vibes</span>
                </Link>
              </li>
              {isAuthenticated && (
                <li>
                  <Link to="/settings" onClick={() => onClose()} className="vibes-sidebar-card">
                    <GearIcon className="vibes-sidebar-icon icon-settings" />
                    <span>Settings</span>
                  </Link>
                </li>
              )}
              <li>
                <Link to="/about" onClick={() => onClose()} className="vibes-sidebar-card">
                  <InfoIcon className="vibes-sidebar-icon icon-about" />
                  <span>About</span>
                </Link>
              </li>
            </ul>
          </nav>

          {/* Auth section at bottom */}
          <div className="vibes-sidebar-auth">
            {isLoading ? (
              <div className="vibes-sidebar-card" style={{ opacity: 0.5 }}>
                <span className="animate-pulse">Loading...</span>
              </div>
            ) : isAuthenticated ? (
              <>
                <div className="vibes-sidebar-account">
                  <div className="vibes-sidebar-account-email">{userEmail}</div>
                  <button
                    type="button"
                    className="vibes-sidebar-signout"
                    onClick={async () => {
                      await clerk.signOut();
                      onClose();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : isPolling ? (
              <div className="vibes-sidebar-card" style={{ opacity: 0.7 }}>
                <span>Opening log in window...</span>
              </div>
            ) : (
              <>
                {pollError && <div className="vibes-sidebar-card-meta">{pollError}</div>}
                <button
                  type="button"
                  onClick={() => setShowSignIn(true)}
                  className="vibes-sidebar-card vibes-sidebar-login-btn"
                >
                  <span>Log in</span>
                </button>
              </>
            )}
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
    </>
  );
}

export default memo(SessionSidebar, (prevProps, nextProps) => {
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.onClose === nextProps.onClose &&
    prevProps.sessionId === nextProps.sessionId
  );
});
