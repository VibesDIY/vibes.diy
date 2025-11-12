import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, useParams, Outlet } from "react-router";
import { BrutalistCard, VibesButton } from "@vibes.diy/use-vibes-base";
import {
  partyPlannerPrompt,
  progressTrackerPrompt,
  jamSessionPrompt,
} from "../data/quick-suggestions-data.js";
import { parseContent } from "@vibes.diy/prompts";
import { useFireproof } from "use-fireproof";
import ReactMarkdown from "react-markdown";
import { useSimpleChat } from "../hooks/useSimpleChat.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useAuthPopup } from "../hooks/useAuthPopup.js";
import { NeedsLoginModal } from "../components/NeedsLoginModal.js";

export function meta() {
  return [
    { title: "Create - Vibes DIY" },
    { name: "description", content: "Create a new Vibe" },
  ];
}

interface CreateSessionDoc {
  type: "create-session";
  prompt: string;
  created_at: number;
}

// Separate component for the streaming view to avoid conditional hooks
function CreateWithStreaming({
  sessionId,
  promptText,
  onNavigateToPreview,
}: {
  sessionId: string;
  promptText: string;
  onNavigateToPreview: (code: string) => void;
}) {
  const chatState = useSimpleChat(sessionId);
  const hasSentMessage = useRef(false);
  const hasNavigated = useRef(false);

  // Send the message once chatState is ready
  useEffect(() => {
    if (chatState && promptText && !hasSentMessage.current) {
      hasSentMessage.current = true;
      // Set the input and send the message
      chatState.setInput(promptText);
      chatState.sendMessage(promptText);
    }
  }, [chatState, promptText]);

  // Auto-navigate to preview when we detect content after code segment
  useEffect(() => {
    if (hasNavigated.current) return;

    const latestAiMessage = chatState.docs
      .filter((doc) => doc.type === "ai")
      .sort((a, b) => b.created_at - a.created_at)[0];

    if (!latestAiMessage?.text) return;

    const parsed = parseContent(latestAiMessage.text);
    const segments = parsed.segments;
    const codeSegments = segments.filter((seg) => seg.type === "code");

    // Check if we have code and content after the last code segment
    if (codeSegments.length > 0) {
      const lastCodeIndex = segments.findLastIndex(
        (seg) => seg.type === "code",
      );
      const hasContentAfterCode =
        segments.length > lastCodeIndex + 1 &&
        segments
          .slice(lastCodeIndex + 1)
          .some((seg) => seg.content && seg.content.trim().length > 0);

      if (hasContentAfterCode) {
        hasNavigated.current = true;
        const code = codeSegments[0]?.content || "";
        onNavigateToPreview(code);
      }
    }
  }, [chatState.docs, onNavigateToPreview]);

  // Auto-scroll to bottom when segments change
  useEffect(() => {
    const latestAiMessage = chatState.docs
      .filter((doc) => doc.type === "ai")
      .sort((a, b) => b.created_at - a.created_at)[0];

    if (!latestAiMessage?.text) return;

    // Scroll to bottom smoothly whenever content updates
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  }, [chatState.docs]);

  return (
    <>
      {/* Streaming Display Section */}
      {(() => {
        // Get the latest AI message
        const latestAiMessage = chatState.docs
          .filter((doc) => doc.type === "ai")
          .sort((a, b) => b.created_at - a.created_at)[0];

        if (!latestAiMessage?.text) return null;

        const parsed = parseContent(latestAiMessage.text);
        const segments = parsed.segments;
        const codeSegments = segments.filter((seg) => seg.type === "code");
        const codeLines = codeSegments.reduce(
          (acc, seg) => acc + (seg.content?.split("\n").length || 0),
          0,
        );

        return (
          <>
            {segments.map((segment, index) => {
              if (segment.type === "markdown" && segment.content) {
                return (
                  <BrutalistCard key={`markdown-${index}`} size="md">
                    <div className="ai-markdown prose">
                      <ReactMarkdown>{segment.content}</ReactMarkdown>
                    </div>
                  </BrutalistCard>
                );
              } else if (segment.type === "code" && segment.content) {
                return (
                  <BrutalistCard key={`code-${index}`} size="md">
                    <div className="flex items-center justify-between p-2">
                      <span className="font-mono text-sm text-accent-01 dark:text-accent-01">
                        {`${codeLines} line${codeLines !== 1 ? "s" : ""}`}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(segment.content || "");
                        }}
                        className="rounded-sm bg-light-background-02 px-2 py-1 text-sm text-accent-01 transition-colors hover:text-accent-02 active:bg-orange-400 active:text-orange-800 dark:bg-dark-background-01 dark:text-accent-01 dark:hover:bg-dark-decorative-00 dark:hover:text-dark-secondary dark:active:bg-orange-600 dark:active:text-orange-200"
                      >
                        <code className="font-mono">
                          <span className="mr-3">App.jsx</span>
                          <svg
                            aria-hidden="true"
                            height="16"
                            viewBox="0 0 16 16"
                            version="1.1"
                            width="16"
                            className="inline-block"
                          >
                            <path
                              fill="currentColor"
                              d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"
                            ></path>
                            <path
                              fill="currentColor"
                              d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"
                            ></path>
                          </svg>
                        </code>
                      </button>
                    </div>
                    <pre className="m-0 overflow-x-auto rounded-sm bg-light-background-02 p-4 font-mono text-sm dark:bg-dark-background-01">
                      <code>
                        {segment.content.split("\n").slice(-3).join("\n")}
                      </code>
                    </pre>
                  </BrutalistCard>
                );
              }
              return null;
            })}

            {/* Show streaming indicator when actively streaming */}
            {chatState.isStreaming && (
              <BrutalistCard size="sm">
                <div className="flex items-center gap-2 text-sm">
                  <span className="bg-light-primary dark:bg-dark-primary inline-block h-4 w-2 animate-pulse" />
                  <span>Generating...</span>
                </div>
              </BrutalistCard>
            )}
          </>
        );
      })()}
    </>
  );
}

export default function Create() {
  const [promptText, setPromptText] = useState("");
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize Fireproof for create sessions - we'll use this to generate IDs
  const { database } = useFireproof("create-sessions");

  // Get auth state
  const { isAuthenticated } = useAuth();
  const { initiateLogin } = useAuthPopup();

  // Get sessionId from URL params
  const sessionId = params.sessionId || null;

  // Check if we're on the preview route
  const isPreviewRoute = location.pathname.endsWith("/preview");

  // Ref to guard against double-invocation in StrictMode
  const autoSubmitExecuted = useRef(false);

  // Shared helper to create session and navigate
  const createAndNavigateToSession = async (prompt: string) => {
    try {
      const sessionDoc: CreateSessionDoc = {
        type: "create-session",
        prompt: prompt.trim(),
        created_at: Date.now(),
      };

      const result = await database.put(sessionDoc);
      const newSessionId = result.id;
      console.log("Created session with ID:", newSessionId);

      navigate(`/create/${newSessionId}`);
    } catch (error) {
      console.error("Failed to create session:", error);
      // Reset pending state so user can retry
      setPendingSubmit(false);
      throw error;
    }
  };

  // Auto-submit after successful login
  useEffect(() => {
    if (pendingSubmit && isAuthenticated && !autoSubmitExecuted.current) {
      autoSubmitExecuted.current = true;
      console.log("User authenticated, auto-submitting pending request");
      setPendingSubmit(false);

      if (promptText.trim() && !sessionId) {
        createAndNavigateToSession(promptText.trim()).catch((error) => {
          console.error("Auto-submit failed:", error);
          autoSubmitExecuted.current = false; // Allow retry
        });
      }
    }
  }, [pendingSubmit, isAuthenticated, promptText, sessionId]);

  const handleLetsGo = async () => {
    console.log("=== handleLetsGo called ===");
    console.log("isAuthenticated:", isAuthenticated);
    console.log("promptText:", promptText);
    console.log("sessionId:", sessionId);

    // Check authentication before proceeding
    if (!isAuthenticated) {
      console.log(
        "Not authenticated, triggering login popup and marking as pending submit",
      );
      setPendingSubmit(true); // Mark that we want to submit after login
      await initiateLogin(); // Directly open auth popup
      return;
    }

    console.log("User is authenticated");

    if (promptText.trim() && !sessionId) {
      console.log("Creating session with prompt:", promptText.trim());
      await createAndNavigateToSession(promptText.trim());
    } else {
      console.log(
        "Skipping session creation - promptText:",
        promptText,
        "sessionId:",
        sessionId,
      );
    }
  };

  const handleNavigateToPreview = (code: string) => {
    navigate(`/create/${sessionId}/preview`, {
      state: {
        code,
        sessionId,
      },
    });
  };

  // If on preview route, only render the Outlet
  if (isPreviewRoute) {
    return <Outlet />;
  }

  return (
    <div className="page-grid-background grid-background min-h-screen min-h-[100svh] min-h-[100dvh] w-full">
      <div className="flex items-start justify-center p-4">
        <div
          style={{
            maxWidth: "800px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <BrutalistCard size="lg">
            <h1 className="text-4xl font-bold">Vibes are for sharing</h1>
          </BrutalistCard>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <VibesButton
              variant="primary"
              style={{ flex: "1" }}
              onClick={() => setPromptText(partyPlannerPrompt)}
            >
              Party Planner
            </VibesButton>
            <VibesButton
              variant="secondary"
              style={{ flex: "1" }}
              onClick={() => setPromptText(progressTrackerPrompt)}
            >
              Progress Tracker
            </VibesButton>
            <VibesButton
              variant="tertiary"
              style={{ flex: "1" }}
              onClick={() => setPromptText(jamSessionPrompt)}
            >
              Jam Session
            </VibesButton>
          </div>

          <BrutalistCard size="md" style={{ width: "100%" }}>
            <div style={{ marginBottom: "12px", fontWeight: 600 }}>
              Describe your vibe
            </div>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="What do you want to build..."
              rows={6}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                color: "inherit",
                fontSize: "inherit",
                fontWeight: "inherit",
                letterSpacing: "inherit",
                padding: "4px",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </BrutalistCard>

          {/* Streaming Display Section */}
          {sessionId && (
            <CreateWithStreaming
              sessionId={sessionId}
              promptText={promptText}
              onNavigateToPreview={handleNavigateToPreview}
            />
          )}

          <VibesButton
            variant="primary"
            style={{ width: "200px" }}
            onClick={handleLetsGo}
            disabled={!!sessionId}
          >
            {sessionId ? "Generating..." : "Let's Go"}
          </VibesButton>

          <a
            href="/"
            style={{ textAlign: "right", textDecoration: "underline" }}
          >
            Learn
          </a>
        </div>
      </div>

      {/* Login modal - appears when needsLogin is true */}
      <NeedsLoginModal />
    </div>
  );
}
