import React, { ReactNode } from "react";

interface SimpleAppLayoutProps {
  headerLeft?: ReactNode;
  children: ReactNode;
}

/**
 * A simplified layout component that provides a full-page content area without the chat/preview split.
 * Used for pages that need a simpler layout with just a header and scrollable content area.
 */
export default function SimpleAppLayout({
  headerLeft,
  children,
}: SimpleAppLayoutProps) {
  return (
    <div className="bg-light-background dark:bg-dark-background flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex h-[4rem] items-center p-2">
        <div data-testid="header-left" className="flex items-center">
          {headerLeft}
        </div>
      </header>

      {/* Content area with natural scrolling */}
      <main className="flex-grow">
        <div className="mx-auto px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
