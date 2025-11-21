import React, { useEffect, useState } from "react";
import { VibesSwitch } from "use-vibes";
import {
  LabelContainer,
  VibesButton,
} from "@vibes.diy/use-vibes-base";

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
  isAuthenticated: boolean;
  isLoading: boolean;
}

export default function LoggedOutView({ onLogin, isAuthenticated, isLoading }: LoggedOutViewProps) {
  // Typewriter effect state
    const [displayedText, setDisplayedText] = useState("");
    const fullText = "Welcome to Vibes DIY";
  
    // Typewriter animation effect
    useEffect(() => {
      if (!isAuthenticated && !isLoading) {
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
    }, [isAuthenticated, isLoading]);
  return (
          <div className="grid-background flex h-screen w-screen items-center justify-center relative">
            {/* Center content */}
            <div className="text-center px-4 w-full">
              <LabelContainer label="Login">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <VibesButton icon="logout" variant={"blue"} onClick={onLogin}>
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
