import React, { useState, useCallback } from "react";
import { BrutalistCard } from "@vibes.diy/use-vibes-base";
import SessionSidebar from "./SessionSidebar.js";

interface BrutalistLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
}

/**
 * Shared layout for brutalist-styled pages (Groups, Settings, Vibe Instances)
 * Provides consistent page structure with SessionSidebar integration
 */
export default function BrutalistLayout({
  children,
  title,
  subtitle,
  headerActions,
}: BrutalistLayoutProps) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  const openSidebar = useCallback(() => {
    setIsSidebarVisible(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  return (
    <div className="page-grid-background grid-background min-h-screen min-h-[100svh] min-h-[100dvh] w-full relative">
      {/* SessionSidebar */}
      <SessionSidebar
        isVisible={isSidebarVisible}
        onClose={closeSidebar}
        sessionId=""
      />

      {/* Hamburger menu button - fixed top left */}
      <div className="absolute top-4 left-4">
        <button
          onClick={openSidebar}
          className="flex items-center justify-center p-3 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Open menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 px-8 py-8">
        <div
          style={{
            maxWidth: "1000px",
            width: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {/* Header card */}
          <BrutalistCard size="lg">
            <div className="flex items-center justify-between">
              {/* Title */}
              <div className="flex-1">
                <h1 className="text-4xl font-bold mb-2">{title}</h1>
                {subtitle && (
                  <p
                    className="text-lg"
                    style={{ color: "var(--vibes-text-secondary)" }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Header actions */}
              {headerActions && (
                <div className="flex items-center gap-3">{headerActions}</div>
              )}
            </div>
          </BrutalistCard>

          {/* Page content */}
          {children}
        </div>
      </div>
    </div>
  );
}
