import React, { useState, useCallback } from "react";
import { BrutalistCard, VibesSwitch } from "@vibes.diy/use-vibes-base";
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

  const closeSidebar = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  return (
    <div className="page-grid-background grid-background min-h-screen min-h-[100svh] min-h-[100dvh] w-full">
      {/* SessionSidebar */}
      <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} />

      <div className="px-8 pt-0">
        {/* Hamburger menu button - top left in normal flow with z-index */}
        <div className="mb-8 ml-0 relative z-20">
          <VibesSwitch
            size={75}
            isActive={isSidebarVisible}
            onToggle={setIsSidebarVisible}
            className="cursor-pointer"
          />
        </div>
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
