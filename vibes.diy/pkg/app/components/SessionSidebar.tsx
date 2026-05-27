import React, { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { SignIn, useAuth, useClerk, useUser } from "@clerk/react";
import type { SessionSidebarProps } from "@vibes.diy/prompts";
import { GearIcon } from "./SessionSidebar/GearIcon.js";
import { InfoIcon } from "./SessionSidebar/InfoIcon.js";
import { Memberships } from "./SessionSidebar/Memberships.js";
import { RecentVibes } from "./RecentVibes.js";

type SidebarSection = "apps" | "memberships";

function SessionSidebar({ isVisible, onClose, dmUnreadCount }: SessionSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { isSignedIn: isAuthenticated, isLoaded } = useAuth();
  const isLoading = !isLoaded;
  const clerk = useClerk();
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const [showSignIn, setShowSignIn] = useState(false);
  const [expandedSection, setExpandedSection] = useState<SidebarSection>("apps");

  // Handle pointerdown outside the sidebar to close it. We listen for
  // pointerdown rather than mousedown so a single event covers both mouse
  // and touch — touch taps fire pointerdown at touchstart, and on touchend
  // browsers synthesize a mousedown that lands on the same target as the
  // touch. If we listened for mousedown, the tap on the pill that opened us
  // would fire its synthetic mousedown on the pill, the handler would see
  // the pill as outside the sidebar, and immediately close us. Pointerdown
  // also lets us short-circuit on the toggle itself via [data-sidebar-toggle]
  // so the same gesture that opened us cannot close us through a click-
  // outside path.
  useEffect(() => {
    if (!isVisible) return;

    function handleClickOutside(event: PointerEvent) {
      const target = event.target as Element | null;
      if (target === null) return;
      if (sidebarRef.current?.contains(target)) return;
      if (target.closest('[data-sidebar-toggle="true"]') !== null) return;
      onClose();
    }

    document.addEventListener("pointerdown", handleClickOutside);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [isVisible, onClose]);

  // Conditionally render content but keep animation classes
  return (
    <div
      ref={sidebarRef}
      data-testid="session-sidebar"
      className={`bg-light-background-00 dark:bg-dark-background-00 fixed top-0 left-0 z-10 h-full shadow-lg transition-all duration-300 border-r-4 border-[var(--vibes-near-black)] ${
        isVisible ? "w-64 translate-x-0" : "w-64 -translate-x-full"
      }`}
    >
      <div className="flex h-full flex-col overflow-hidden pt-16">
        <div className="shrink-0 px-4">
          <Link
            to="/"
            onClick={() => onClose()}
            className="flex items-center px-4 py-3 text-sm font-medium tracking-wide transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/10 border-b border-black/10 dark:border-white/10"
          >
            <svg
              className="text-accent-01 mr-3 h-5 w-5"
              width="22"
              height="22"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>New Vibe</span>
          </Link>
          <Link
            to="/messages"
            onClick={() => onClose()}
            className="flex items-center px-4 py-3 text-sm font-medium tracking-wide transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/10 border-b border-black/10 dark:border-white/10"
          >
            <svg
              className="mr-3 h-5 w-5"
              width="22"
              height="22"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z"
              />
            </svg>
            <span className="flex-1">Messages</span>
            {dmUnreadCount && dmUnreadCount > 0 ? (
              <span
                style={{
                  background: "#3b82f6",
                  color: "#fff",
                  borderRadius: 9999,
                  padding: "0 6px",
                  fontSize: 12,
                  fontWeight: 700,
                  minWidth: 20,
                  textAlign: "center",
                }}
              >
                {(dmUnreadCount ?? 0) > 99 ? "99+" : dmUnreadCount}
              </span>
            ) : null}
          </Link>
        </div>
        {/* Accordion: only one section expanded at a time. "My Apps" header
            always sits at the top; "Memberships" header always sits below it
            (either right after as the active header, or pinned at the bottom
            as the inactive header). Each header is a toggle — clicking it
            flips which section is active. */}
        <nav className="flex-1 flex flex-col min-h-0 px-4">
          {(() => {
            const toggle = () => setExpandedSection((s) => (s === "apps" ? "memberships" : "apps"));
            return (
              <>
                <SidebarSectionHeader label="My Apps" isActive={expandedSection === "apps"} onClick={toggle} />

                {expandedSection === "apps" ? (
                  <>
                    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
                      <RecentVibes onNavigate={onClose} hideTitle hideSeeAll />
                      <Link
                        to="/vibes/mine"
                        onClick={onClose}
                        className="mt-auto flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium opacity-60 transition-colors hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        <span>See all vibes</span>
                      </Link>
                    </div>
                    <SidebarSectionHeader label="Memberships" isActive={false} onClick={toggle} />
                  </>
                ) : (
                  <>
                    <SidebarSectionHeader label="Memberships" isActive onClick={toggle} />
                    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
                      <Memberships onNavigate={onClose} />
                      <Link
                        to="/memberships"
                        onClick={onClose}
                        className="mt-auto flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium opacity-60 transition-colors hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        <span>See all memberships</span>
                      </Link>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </nav>

        {/* Bottom section — pinned */}
        <div className="shrink-0 pb-6 px-4">
          <Link
            to="/about"
            onClick={() => onClose()}
            className="flex items-center px-4 py-3 text-sm font-medium tracking-wide transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/10 border-t border-black/10 dark:border-white/10"
          >
            <InfoIcon className="text-accent-01 mr-3 h-5 w-5" />
            <span>About</span>
          </Link>
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

interface SidebarSectionHeaderProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function SidebarSectionHeader({ label, isActive, onClick }: SidebarSectionHeaderProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isActive}
      className="sticky -top-3 z-10 flex w-full items-center justify-between bg-light-background-00 dark:bg-dark-background-00 px-4 pt-5 pb-2 text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors"
    >
      <span>{label}</span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: isActive ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.25s ease",
        }}
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}

// Export a memoized version of the component to prevent unnecessary re-renders
export default memo(SessionSidebar, (prevProps, nextProps) => {
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.onClose === nextProps.onClose &&
    prevProps.sessionId === nextProps.sessionId &&
    prevProps.dmUnreadCount === nextProps.dmUnreadCount
  );
});
