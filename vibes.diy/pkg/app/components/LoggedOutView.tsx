import React from "react";
import { VibesSwitch } from "use-vibes";

// Vibe switch button component with animation
function VibesLoginButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="vibes-login-button">
      Login
    </button>
  );
}

export interface LoggedOutViewProps {
  /** Login handler function */
  onLogin: () => void;
}

export default function LoggedOutView({ onLogin }: LoggedOutViewProps) {
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
        <VibesLoginButton onClick={onLogin} />
      </div>

      {/* Vibe switch in lower right corner */}
      <button
        type="button"
        onClick={onLogin}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onLogin();
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
