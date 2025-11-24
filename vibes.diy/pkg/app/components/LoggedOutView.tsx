import React from "react";
import { VibesSwitch } from "use-vibes";
import { useClerk } from "@clerk/clerk-react";
import { trackAuthClick } from "../utils/analytics.js";

// Vibe switch button component with animation
function VibesLoginButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="vibes-login-button">
      Login
    </button>
  );
}

export interface LoggedOutViewProps {
  /** Whether Clerk has finished loading */
  isLoaded?: boolean;
  /** Optional event name for analytics tracking */
  trackingEventName?: string;
}

export default function LoggedOutView({
  isLoaded = true,
  trackingEventName,
}: LoggedOutViewProps) {
  const clerk = useClerk();

  const handleLogin = async () => {
    if (trackingEventName) {
      trackAuthClick({
        label: trackingEventName,
        isUserAuthenticated: false,
      });
    }
    await clerk.redirectToSignIn({
      redirectUrl: window.location.href,
    });
  };

  // Show loading state with grid background
  if (!isLoaded) {
    return (
      <div className="grid-background flex h-screen w-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg" style={{ color: "#1a1a1a" }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid-background flex h-screen w-screen items-center justify-center relative">
      {/* Center content */}
      <div className="text-center max-w-md px-4 w-full">
        <h1 className="mb-4 text-3xl font-bold" style={{ color: "#1a1a1a" }}>
          Welcome to Vibes DIY
        </h1>
        <p className="mb-6 text-lg" style={{ color: "#1a1a1a" }}>
          You can just code things.
        </p>
        <VibesLoginButton onClick={handleLogin} />
      </div>

      {/* Vibe switch in lower right corner */}
      <button
        type="button"
        onClick={handleLogin}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleLogin();
          }
        }}
        className="cursor-pointer fixed"
        style={{
          bottom: "1.5rem",
          right: "6rem",
          width: "80px",
          zIndex: 50,
          background: "none",
          border: "none",
          padding: 0,
        }}
        aria-label="Login to Vibes DIY"
      >
        <VibesSwitch size={80} />
      </button>
    </div>
  );
}
