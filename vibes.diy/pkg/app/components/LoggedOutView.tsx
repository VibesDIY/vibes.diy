import React, { useEffect, useState } from "react";
import { VibesSwitch } from "use-vibes";
import { useClerk } from "@clerk/clerk-react";
import { trackAuthClick } from "../utils/analytics.js";
import {
  LabelContainer,
  useMobile,
  VibesButton,
} from "@vibes.diy/use-vibes-base";

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
  // Typewriter effect state
  const [displayedText, setDisplayedText] = useState("");
  const fullText = "Welcome to Vibes DIY";
  const isMobile = useMobile();

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

  // Typewriter animation effect
  useEffect(() => {
    if (isLoaded) {
      let currentIndex = 0;
      const typingSpeed = 100; // milliseconds per character

      const typingInterval = setInterval(() => {
        if (currentIndex <= fullText.length) {
          setDisplayedText(fullText.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(typingInterval);
        }
      }, typingSpeed);

      return () => clearInterval(typingInterval);
    }
  }, [isLoaded]);

  // Show loading state with grid background
  if (!isLoaded) {
    return (
      <div className="grid-background flex h-screen w-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg" style={{ color: "var(--vibes-text-primary)" }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid-background flex h-screen w-screen items-center justify-center relative">
      {/* Center content */}
      <div className="text-center px-8 w-full">
        <LabelContainer label="Login">
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column-reverse" : "row",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <VibesButton icon="logout" variant={"blue"} onClick={handleLogin}>
              Login
            </VibesButton>
            <div style={{ width: "300px" }}>
              <h1
                className="mb-4 text-3xl font-bold"
                style={{ color: "var(--vibes-text-primary)" }}
              >
                {displayedText}
                <span
                  style={{
                    display: "inline-block",
                    width: "3px",
                    height: "1em",
                    backgroundColor: "var(--vibes-text-primary)",
                    marginLeft: "2px",
                    animation: "blink 1s step-end infinite",
                  }}
                />
              </h1>
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                    @keyframes blink {
                      0%, 50% { opacity: 1; }
                      51%, 100% { opacity: 0; }
                    }
                  `,
                }}
              />
              <p
                className="mb-6 text-lg"
                style={{ color: "var(--vibes-text-primary)" }}
              >
                You can just code things.
              </p>
            </div>
          </div>
        </LabelContainer>
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
