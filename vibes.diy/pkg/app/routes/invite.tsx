import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useDashboard } from "../contexts/DashboardContext.js";
import LoggedOutView from "../components/LoggedOutView.js";
import { LabelContainer } from "../components/vibes/LabelContainer/index.js";
import { useMobile } from "@vibes.diy/use-vibes-base";
import {
  getButtonStyle,
  getMergedButtonStyle,
  getIconContainerStyle,
  getIconStyle,
  getContentWrapperStyle,
} from "../components/vibes/VibesButton/VibesButton.styles.js";

// Envelope/Mail icon for invite
function InviteIcon({
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
      {/* Envelope shape */}
      <path
        d="M8 14H36V30H8V14Z"
        stroke={fill}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M8 14L22 24L36 14"
        stroke={fill}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InviteContent() {
  const [searchParams] = useSearchParams();
  const { dashApi } = useDashboard();
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  );
  const [message, setMessage] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const isMobile = useMobile();

  const email = searchParams.get("email");
  const db = searchParams.get("db"); // Base database name (e.g., "tiny-todos")
  const vibe = searchParams.get("vibe"); // Title ID from URL
  const group = searchParams.get("group"); // Install ID from URL

  // Construct return URL from vibe and group
  const vibeUrl =
    vibe && group
      ? `${window.location.origin}/vibe/${vibe}/${group}`
      : window.location.origin;

  // Text for typewriter animation based on status
  const fullText =
    status === "processing"
      ? "Sending invite..."
      : status === "success"
        ? "Invite sent!"
        : "Invite failed";

  // Typewriter animation effect
  useEffect(() => {
    setDisplayedText(""); // Reset on status change
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
  }, [fullText]);

  useEffect(() => {
    async function processInvite() {
      if (!email || !db || !vibe || !group) {
        setStatus("error");
        setMessage("Missing required parameters (email, db, vibe, or group)");
        return;
      }

      // Construct full database name: vf-{db}-{vibe}-{group}
      const fullDbName = `vf-${db}-${vibe}-${group}`;

      // Get ledger info from database name
      const tokenResult = await dashApi.ensureCloudToken({
        appId: fullDbName,
      });
      if (tokenResult.isErr()) {
        const error = tokenResult.Err();
        console.error("[invite] ensureCloudToken failed:", {
          appId: fullDbName,
          error: error,
        });
        setStatus("error");
        setMessage(error.message || "Failed to get cloud token");
        return;
      }

      const ledgerId = tokenResult.Ok().ledger;

      // Invite user to ledger
      const inviteResult = await dashApi.inviteUser({
        ticket: {
          query: { byEmail: email },
          invitedParams: {
            ledger: {
              id: ledgerId,
              role: "member",
              right: "read",
            },
          },
        },
      });

      if (inviteResult.isErr()) {
        const error = inviteResult.Err();
        console.error("[invite] inviteUser failed:", {
          email,
          ledgerId,
          error: error,
        });
        setStatus("error");
        setMessage(error.message || "Failed to send invite");
        return;
      }

      setStatus("success");
      setMessage(`Invite sent successfully!`);
    }

    processInvite();
  }, [email, db, vibe, group, dashApi]);

  // Determine button variant based on status
  const buttonVariant =
    status === "processing" ? "gray" : status === "success" ? "blue" : "red";

  return (
    <div className="grid-background flex h-screen w-screen items-center justify-center">
      <div className="text-center px-8 w-full">
        <LabelContainer label="Invite">
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
            }}
          >
            {/* Non-clickable button with invite icon - using VibesButton styling */}
            <div
              style={{
                ...getMergedButtonStyle(
                  getButtonStyle(buttonVariant, false, false, isMobile, true),
                  false,
                  { cursor: "default", pointerEvents: "none" },
                ),
              }}
            >
              <div style={getContentWrapperStyle(isMobile, true)}>
                <div
                  style={getIconContainerStyle(buttonVariant, isMobile, true)}
                >
                  <div style={getIconStyle(isMobile, false, false)}>
                    <InviteIcon
                      bgFill="var(--vibes-button-icon-bg)"
                      fill="var(--vibes-button-icon-fill)"
                      width={isMobile ? 28 : 50}
                      height={isMobile ? 28 : 50}
                    />
                  </div>
                </div>
                <span>INVITE</span>
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
              {status === "processing" && (
                <p
                  className="mb-6 text-lg"
                  style={{ color: "var(--vibes-text-primary)" }}
                >
                  Processing invite...
                </p>
              )}
              {status === "success" && (
                <div>
                  <p
                    className="mb-4 text-lg"
                    style={{ color: "var(--vibes-text-primary)" }}
                  >
                    {message}
                  </p>
                  <p
                    className="mb-2 text-sm"
                    style={{ color: "var(--vibes-text-secondary)" }}
                  >
                    Send them this URL:
                  </p>
                  <a
                    href={vibeUrl}
                    className="text-blue-600 underline break-all"
                  >
                    {vibeUrl}
                  </a>
                </div>
              )}
              {status === "error" && (
                <p
                  className="mb-6 text-lg text-red-600"
                  style={{ color: "var(--vibes-error-text)" }}
                >
                  {message}
                </p>
              )}

              {/* Always show invite details at bottom */}
              <div
                className="mt-4 text-xs font-mono"
                style={{ color: "var(--vibes-text-secondary)" }}
              >
                <div>{email}</div>
                <div>
                  {vibe} / {db} / {group}
                </div>
              </div>
            </div>
          </div>
        </LabelContainer>
      </div>
    </div>
  );
}

// Auth wrapper component (same pattern as Settings)
export function Invite() {
  const { isSignedIn, isLoaded } = useClerkAuth();

  if (!isSignedIn) {
    return <LoggedOutView isLoaded={isLoaded} />;
  }

  return <InviteContent />;
}
