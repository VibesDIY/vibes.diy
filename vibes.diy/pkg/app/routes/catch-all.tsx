import React from "react";
import { useLocation, Link } from "react-router-dom";
import VibesDIYLogo from "../components/VibesDIYLogo.js";
import VibespaceComponent from "../components/VibespaceComponent.js";

export function meta({ location }: { location: { pathname: string } }) {
  const path = location.pathname;
  const userSpaceMatch = path.match(/^\/([~@])(.+)$/);

  if (userSpaceMatch) {
    return [
      { title: "Space Vibes - Vibes DIY" },
      { name: "description", content: "User space in Vibes DIY" },
    ];
  }

  return [
    { title: "Page Not Found - Vibes DIY" },
    {
      name: "description",
      content: "The page you are looking for could not be found.",
    },
  ];
}

export default function CatchAllDispatcher() {
  const location = useLocation();
  const path = location.pathname;

  // Check if this is a user space route (~username or @username)
  const userSpaceMatch = path.match(/^\/([~@])(.+)$/);

  if (userSpaceMatch) {
    const [, prefix, cleanUserId] = userSpaceMatch;

    if (prefix === "~") {
      return <VibespaceComponent tildeId={cleanUserId} />;
    } else if (prefix === "@") {
      return <VibespaceComponent atId={cleanUserId} />;
    }
  }

  // Otherwise, render the 404 page
  return <NotFoundPage />;
}

function NotFoundPage() {
  return (
    <div className="grid-background flex min-h-screen flex-col items-center justify-center">
      {/* Film strip holes */}
      <div className="absolute top-0 bottom-0 left-4 flex w-6 flex-col justify-center space-y-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-4 rounded-sm border border-gray-600 bg-black"
          ></div>
        ))}
      </div>
      <div className="absolute top-0 right-4 bottom-0 flex w-6 flex-col justify-center space-y-4">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-4 rounded-sm border border-gray-600 bg-black"
          ></div>
        ))}
      </div>

      {/* Main content */}
      <div className="text-center">
        <div className="mb-12">
          <Link to="/">
            <VibesDIYLogo height={60} />
          </Link>
        </div>

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
            className="text-lg tracking-wide text-gray-300 transition-colors duration-300 hover:text-white"
            style={{
              fontFamily: "Courier New, monospace",
              textShadow: "1px 1px 2px rgba(0, 0, 0, 0.5)",
            }}
          >
            → HOME
          </Link>
        </div>
      </div>
    </div>
  );
}
