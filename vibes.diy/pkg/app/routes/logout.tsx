import React, { useEffect, useState } from "react";
import { useClerk } from "@clerk/clerk-react";
import { LabelContainer } from "../components/vibes/LabelContainer/index.js";
import { useMobile } from "@vibes.diy/use-vibes-base";
import {
  getButtonStyle,
  getMergedButtonStyle,
  getIconContainerStyle,
  getIconStyle,
  getContentWrapperStyle,
} from "../components/vibes/VibesButton/VibesButton.styles.js";

// Tornado/Wormhole icon for logout - similar to LoginIcon pattern
function LogoutIcon({
  bgFill = "#fff",
  fill = "#2a2a2a",
  width = 44,
  height = 44,
}: {
  bgFill?: string;
  fill?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="22" cy="22" r="22" fill={bgFill} />
      {/* Tornado/vortex spiral shape */}
      <path
        d="M8 12H36M11 18H33M14 24H30M17 30H27M20 36H24"
        stroke={fill}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Logout route that signs the user out via Clerk
 *
 * This route is used by vibe pages (which don't have Clerk loaded)
 * to log out by redirecting to this route in the main app.
 */
export function Logout() {
  const { signOut } = useClerk();
  const [displayedText, setDisplayedText] = useState("");
  const isMobile = useMobile();
  const [returnUrl] = useState(() => {
    // Capture the referrer on mount - go back where user came from
    const referrer = document.referrer;
    console.log("Logout: checking referrer", {
      referrer,
      origin: window.location.origin,
    });
    if (referrer && new URL(referrer).origin === window.location.origin) {
      console.log("Logout: will return to referrer", referrer);
      return referrer;
    }
    console.log("Logout: will return to home /");
    return "/";
  });
  const fullText = "Thanks for visiting";

  useEffect(() => {
    // Delay signout to allow the goodbye message to display
    const timer = setTimeout(async () => {
      console.log("Logout: signing out then redirecting to", returnUrl);
      await signOut();
      console.log("Logout: signed out, now navigating to", returnUrl);
      window.location.href = returnUrl;
    }, 2000); // 2 seconds to see the message

    return () => clearTimeout(timer);
  }, [signOut, returnUrl]);

  // Typewriter animation effect
  useEffect(() => {
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
  }, []);

  return (
    <div className="grid-background flex h-screen w-screen items-center justify-center">
      <div className="text-center px-8 w-full">
        <LabelContainer label="Logout">
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
            }}
          >
            {/* Grey non-clickable button with wormhole/tornado icon - using VibesButton styling */}
            <div
              style={{
                ...getMergedButtonStyle(
                  getButtonStyle(
                    "gray",
                    false,
                    false,
                    isMobile,
                    true,
                    "square",
                  ),
                  false,
                  { cursor: "default", pointerEvents: "none" },
                  "square",
                ),
              }}
            >
              <div style={getContentWrapperStyle(isMobile, true)}>
                <div
                  style={getIconContainerStyle(
                    "gray",
                    isMobile,
                    true,
                    "square",
                  )}
                >
                  <div style={getIconStyle(isMobile, false, false)}>
                    <LogoutIcon
                      bgFill="var(--vibes-button-icon-bg)"
                      fill="var(--vibes-button-icon-fill)"
                      width={isMobile ? 28 : 50}
                      height={isMobile ? 28 : 50}
                    />
                  </div>
                </div>
                <span>LOGOUT</span>
              </div>
            </div>
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
                Signing out...
              </p>
            </div>
          </div>
        </LabelContainer>
      </div>
    </div>
  );
}
