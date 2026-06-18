import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { gridBackground, cx } from "@vibes.diy/base";
import { PillPortal } from "../components/PillPortal.js";
import SessionSidebar from "../components/SessionSidebar.js";

export function meta({ location }: { location: { pathname: string } }) {
  const path = location.pathname;
  const userSpaceMatch = path.match(/^\/([~@])(.+)$/);

  if (userSpaceMatch) {
    return [{ title: "Space Vibes - Vibes DIY" }, { name: "description", content: "User space in Vibes DIY" }];
  }

  return [
    { title: "Page Not Found - Vibes DIY" },
    {
      name: "description",
      content: "The page you are looking for could not be found.",
    },
  ];
}

export default function CatchAll() {
  // const location = useLocation();
  // const path = location.pathname;

  // // Check if this is a user space route (~username or @username)
  // const userSpaceMatch = path.match(/^\/([~@])(.+)$/);

  // if (userSpaceMatch) {
  //   const [, prefix, cleanUserId] = userSpaceMatch;

  //   if (prefix === "~") {
  //     return <VibespaceComponent tildeId={cleanUserId} />;
  //   } else if (prefix === "@") {
  //     return <VibespaceComponent atId={cleanUserId} />;
  //   }
  // }

  // Otherwise, render the 404 page
  return <NotFoundPage />;
}

function NotFoundPage() {
  // Match the main page: the top-left pill toggles the nav/sidebar in place
  // rather than navigating away.
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const closeSidebar = useCallback(() => setIsSidebarVisible(false), []);

  return (
    <div className={cx(gridBackground, "flex min-h-screen flex-col items-center justify-center")}>
      {/* Top-left nav pill — same component, position, size, and toggle
          behavior as the main page header. */}
      <PillPortal isActive={isSidebarVisible} onToggle={setIsSidebarVisible} />
      <SessionSidebar isVisible={isSidebarVisible} onClose={closeSidebar} sessionId="" />

      {/* Main content */}
      <div className="text-center">
        {/* Film frame style container */}
        <div
          className="relative mx-8 p-12"
          style={{
            background: "linear-gradient(145deg, #2a2a2a, #1a1a1a)",
            border: "3px solid #444",
            borderRadius: "8px",
            boxShadow: `
            inset 0 2px 4px rgba(255, 255, 255, 0.1),
            inset 0 -2px 4px rgba(0, 0, 0, 0.3),
            0 8px 32px rgba(0, 0, 0, 0.5)
          `,
          }}
        >
          {/* Corner markers */}
          <div className="absolute top-2 left-2 h-3 w-3 border-t-2 border-l-2 border-gray-400"></div>
          <div className="absolute top-2 right-2 h-3 w-3 border-t-2 border-r-2 border-gray-400"></div>
          <div className="absolute bottom-2 left-2 h-3 w-3 border-b-2 border-l-2 border-gray-400"></div>
          <div className="absolute right-2 bottom-2 h-3 w-3 border-r-2 border-b-2 border-gray-400"></div>

          <div className="space-y-6">
            <h1
              className="text-6xl font-black tracking-wider text-white"
              style={{
                textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)",
                fontFamily: "Impact, Arial Black, sans-serif",
                letterSpacing: "0.1em",
              }}
            >
              PAGE
            </h1>
            <h2
              className="text-6xl font-black tracking-wider text-white"
              style={{
                textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)",
                fontFamily: "Impact, Arial Black, sans-serif",
                letterSpacing: "0.1em",
              }}
            >
              MISSING
            </h2>
            <div
              className="text-2xl font-bold text-gray-300"
              style={{
                fontFamily: "Courier New, monospace",
                letterSpacing: "0.2em",
              }}
            >
              404
            </div>
          </div>
        </div>

        <div className="mt-12">
          <Link
            to="/"
            className="inline-block rounded-md border-2 border-[var(--vibes-near-black)] bg-white px-6 py-3 text-lg font-bold tracking-wide text-[var(--vibes-near-black)] shadow-[3px_3px_0_var(--vibes-near-black)] transition-all duration-150 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_var(--vibes-near-black)]"
            style={{
              fontFamily: "Courier New, monospace",
            }}
          >
            → HOME
          </Link>
        </div>
      </div>
    </div>
  );
}
