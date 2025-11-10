import React, { useState } from "react";
import { useNavigate } from "react-router";
import { BrutalistCard, VibesButton } from "@vibes.diy/use-vibes-base";
import {
  partyPlannerPrompt,
  progressTrackerPrompt,
  jamSessionPrompt,
} from "../data/quick-suggestions-data.js";
import { parseContent } from "@vibes.diy/prompts";
import { useFireproof } from "use-fireproof";
import ReactMarkdown from "react-markdown";

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

export default function Create() {
  const [promptText, setPromptText] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [createSessionId, setCreateSessionId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Initialize Fireproof for create sessions
  const { database } = useFireproof("create-sessions");

  const handleLetsGo = async () => {
    if (promptText.trim()) {
      // Create a Fireproof document and use its _id as the session ID
      const sessionDoc: CreateSessionDoc = {
        type: "create-session",
        prompt: promptText.trim(),
        created_at: Date.now(),
      };

      const result = await database.put(sessionDoc);
      const newSessionId = result.id;
      setCreateSessionId(newSessionId);

      // For now, simulate streaming with a simple delay
      // TODO: Wire up actual streamAI call
      setStreamingContent("Generating your app...\n\n```jsx\nfunction App() {\n  return <div>Hello World</div>;\n}\n```\n\nYour app is ready!");

      // After "streaming" completes, navigate to the session
      setTimeout(() => {
        const params = new URLSearchParams();
        params.set("prompt", promptText.trim());
        navigate(`/?${params.toString()}`);
      }, 3000);
    }
  };

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
          {streamingContent && (() => {
            const parsed = parseContent(streamingContent);
            const segments = parsed.segments;
            const codeSegments = segments.filter((seg) => seg.type === "code");
            const codeLines = codeSegments.reduce(
              (acc, seg) => acc + (seg.content?.split("\n").length || 0),
              0
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
                          <code>{segment.content}</code>
                        </pre>
                      </BrutalistCard>
                    );
                  }
                  return null;
                })}
              </>
            );
          })()}

          <VibesButton
            variant="primary"
            style={{ width: "200px" }}
            onClick={handleLetsGo}
          >
            Let's Go
          </VibesButton>

          <a
            href="/"
            style={{ textAlign: "right", textDecoration: "underline" }}
          >
            Learn
          </a>
        </div>
      </div>
    </div>
  );
}
