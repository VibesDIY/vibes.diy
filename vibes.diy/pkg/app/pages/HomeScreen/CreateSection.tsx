import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { BrutalistCard, VibesButton } from "@vibes.diy/use-vibes-base";
import { quickSuggestions } from "../../data/quick-suggestions-data.js";
import { parseContent } from "@vibes.diy/prompts";
import ReactMarkdown from "react-markdown";
import { useSimpleChat } from "../../hooks/useSimpleChat.js";
import { useAuth } from "../../contexts/AuthContext.js";
import { useAuthPopup } from "../../hooks/useAuthPopup.js";
import { NeedsLoginModal } from "../../components/NeedsLoginModal.js";
import { useNewSessionChat } from "../../hooks/useNewSessionChat.js";
import ChatInput from "../../components/ChatInput.js";
import models from "../../data/models.json" with { type: "json" };

// Separate component for the streaming view to avoid conditional hooks
function CreateWithStreaming({
  sessionId,
  promptText,
  onNavigateToPreview,
  shouldGenerate,
  showInputAtBottom,
}: {
  sessionId: string;
  promptText: string;
  onNavigateToPreview: (code: string) => void;
  shouldGenerate: boolean;
  showInputAtBottom?: boolean;
}) {
  const chatState = useSimpleChat(sessionId);
  const hasSentMessage = useRef(false);
  const hasNavigated = useRef(false);
  const [newPromptText, setNewPromptText] = useState("");

  // Send the message once chatState is ready AND shouldGenerate is true
  useEffect(() => {
    if (chatState && promptText && !hasSentMessage.current && shouldGenerate) {
      hasSentMessage.current = true;
      // Set the input and send the message
      chatState.setInput(promptText);
      chatState.sendMessage(promptText);
    }
  }, [chatState, promptText, shouldGenerate]);

  // Auto-navigate to preview when content after code segment STARTS streaming
  // Only triggers during active streaming, not when loading existing sessions
  useEffect(() => {
    if (hasNavigated.current) return;
    // Only auto-navigate when actively streaming
    if (!chatState.isStreaming) return;

    const latestAiMessage = chatState.docs
      .filter((doc) => doc.type === "ai")
      .sort((a, b) => b.created_at - a.created_at)[0];

    if (!latestAiMessage?.text) return;

    const parsed = parseContent(latestAiMessage.text);
    const segments = parsed.segments;
    const codeSegments = segments.filter((seg) => seg.type === "code");

    // Check if we have code and content after the last code segment is CURRENTLY being streamed
    if (codeSegments.length > 0) {
      const lastCodeIndex = segments.findLastIndex(
        (seg) => seg.type === "code",
      );

      // Only navigate if there's content after code AND we're still streaming
      // This means the post-code content is actively being generated RIGHT NOW
      const segmentsAfterCode = segments.slice(lastCodeIndex + 1);
      const hasContentAfterCode = segmentsAfterCode.some(
        (seg) => seg.content && seg.content.trim().length > 0,
      );

      // Additional check: Only navigate if this is fresh content being streamed
      // Check that the last segment after code is at the end (still being written to)
      const isStreamingPostCodeContent =
        hasContentAfterCode &&
        segmentsAfterCode.length > 0 &&
        segments[segments.length - 1] !== segments[lastCodeIndex]; // Last segment is not the code

      if (isStreamingPostCodeContent) {
        hasNavigated.current = true;
        const code = codeSegments[0]?.content || "";
        onNavigateToPreview(code);
      }
    }
  }, [chatState.docs, chatState.isStreaming, onNavigateToPreview]);

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

  // Filter and dedupe AI messages
  const aiMessages = chatState.docs
    .filter((doc) => doc.type === "ai")
    .sort((a, b) => a.created_at - b.created_at);

  // Deduplicate by _id
  const uniqueMessages = Array.from(
    new Map(aiMessages.map((msg) => [msg._id, msg])).values(),
  );

  return (
    <>
      {/* Display all messages in conversation */}
      {uniqueMessages.map((message) => {
        const parsed = parseContent(message.text);
        const segments = parsed.segments;
        const codeSegments = segments.filter((seg) => seg.type === "code");
        const codeLines = codeSegments.reduce(
          (acc, seg) => acc + (seg.content?.split("\n").length || 0),
          0,
        );

        return (
          <div key={message._id}>
            {segments.map((segment, index) => {
              if (segment.type === "markdown" && segment.content) {
                return (
                  <BrutalistCard
                    key={`${message._id}-markdown-${index}`}
                    size="md"
                  >
                    <div className="ai-markdown prose">
                      <ReactMarkdown>{segment.content}</ReactMarkdown>
                    </div>
                  </BrutalistCard>
                );
              } else if (segment.type === "code" && segment.content) {
                return (
                  <BrutalistCard key={`${message._id}-code-${index}`} size="md">
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
          </div>
        );
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

      {/* Input section at bottom when there are existing messages */}
      {showInputAtBottom && chatState.docs.length > 0 && (
        <>
          <BrutalistCard size="md" style={{ width: "100%" }}>
            <div style={{ marginBottom: "12px", fontWeight: 600 }}>
              Continue the conversation
            </div>
            <textarea
              value={newPromptText}
              onChange={(e) => setNewPromptText(e.target.value)}
              placeholder="Add more details or make changes..."
              rows={4}
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
          <VibesButton
            variant="blue"
            style={{ width: "200px" }}
            onClick={() => {
              if (newPromptText.trim()) {
                chatState.sendMessage(newPromptText.trim());
                setNewPromptText("");
              }
            }}
          >
            Let's Go
          </VibesButton>
        </>
      )}
    </>
  );
}

export const CreateSection = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { initiateLogin } = useAuthPopup();
  const autoSubmitExecuted = useRef(false);

  // Get sessionId from URL params
  const sessionId = params.sessionId || null;

  // Initialize state from location.state if available
  const locationState = location.state as
    | { shouldGenerate?: boolean; prompt?: string }
    | undefined;

  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [shouldGenerate, setShouldGenerate] = useState(
    locationState?.shouldGenerate || false,
  );

  // Use chat state for the input UI (only when no session exists yet)
  const chatState = useNewSessionChat(() => {
    // This callback is called after session creation in useNewSessionChat
    // We don't need to do anything here as the hook handles navigation
  });

  // Initialize input from location state if available
  useEffect(() => {
    if (locationState?.prompt && chatState.setInput) {
      chatState.setInput(locationState.prompt);
    }
  }, [locationState?.prompt, chatState.setInput]);

  // Randomly select 3 suggestions from quickSuggestions
  const randomSuggestions = useMemo(() => {
    const shuffled = [...quickSuggestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, []);

  const handleNavigateToPreview = useCallback(
    (code: string) => {
      navigate(`/create/${sessionId}/preview`, {
        state: {
          code,
          sessionId,
        },
      });
    },
    [navigate, sessionId],
  );

  useEffect(() => {
    if (pendingSubmit && isAuthenticated && !autoSubmitExecuted.current) {
      autoSubmitExecuted.current = true;
      setPendingSubmit(false);

      if (chatState.input.trim() && chatState.sendMessage) {
        setShouldGenerate(true);
        chatState
          .sendMessage(chatState.input)
          .then(() => {
            // Session created and navigation handled by hook
          })
          .catch((error) => {
            console.error("Auto-submit failed:", error);
            autoSubmitExecuted.current = false;
            setShouldGenerate(false);
          });
      }
    }
  }, [
    pendingSubmit,
    isAuthenticated,
    chatState.input,
    chatState.sendMessage,
    setShouldGenerate,
  ]);

  const handleLetsGo = async () => {
    if (!isAuthenticated) {
      setPendingSubmit(true);
      await initiateLogin();
      return;
    }

    if (chatState.input.trim() && chatState.sendMessage) {
      setShouldGenerate(true);
      try {
        // Use chatState.sendMessage which handles session creation and navigation
        await chatState.sendMessage(chatState.input);
      } catch (error) {
        setShouldGenerate(false);
      }
    }
  };

  return (
    <div className="w-[500px] flex justify-center p-4">
      <div className="max-w-[500px] min-w-[500px] flex items-start justify-center">
        <div
          style={{
            maxWidth: "800px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            justifyContent: "center",
          }}
        >
          <BrutalistCard size="lg">
            <h1 className="text-4xl font-bold">Vibes are for sharing</h1>
          </BrutalistCard>

          {/* Show suggestion buttons and textarea only when no session exists */}
          {!sessionId && (
            <>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <VibesButton
                  variant="blue"
                  style={{ flex: "1" }}
                  onClick={() => chatState.setInput(randomSuggestions[0].text)}
                >
                  {randomSuggestions[0].label}
                </VibesButton>
                <VibesButton
                  variant="yellow"
                  style={{ flex: "1" }}
                  onClick={() => chatState.setInput(randomSuggestions[1].text)}
                >
                  {randomSuggestions[1].label}
                </VibesButton>
                <VibesButton
                  variant="gray"
                  style={{ flex: "1" }}
                  onClick={() => chatState.setInput(randomSuggestions[2].text)}
                >
                  {randomSuggestions[2].label}
                </VibesButton>
              </div>

              <BrutalistCard size="md" style={{ width: "100%" }}>
                <div style={{ marginBottom: "12px", fontWeight: 600 }}>
                  Describe your vibe
                </div>
                <ChatInput
                  chatState={chatState}
                  showModelPickerInChat={chatState.showModelPickerInChat}
                  currentModel={chatState.effectiveModel}
                  onModelChange={async (modelId: string) => {
                    if (chatState.updateSelectedModel) {
                      await chatState.updateSelectedModel(modelId);
                    }
                  }}
                  models={
                    models as {
                      id: string;
                      name: string;
                      description: string;
                      featured?: boolean;
                    }[]
                  }
                  globalModel={chatState.globalModel}
                  hideSubmitButton={true}
                  onSend={() => {
                    // Session creation is handled in chatState.sendMessage
                  }}
                />
              </BrutalistCard>

              <VibesButton
                variant="blue"
                style={{ width: "200px" }}
                onClick={handleLetsGo}
                disabled={shouldGenerate}
              >
                {shouldGenerate ? "Generating..." : "Let's Go"}
              </VibesButton>
            </>
          )}

          {/* Show first user message when session exists */}
          {sessionId && chatState.input && (
            <BrutalistCard size="md" style={{ width: "100%" }}>
              <div
                style={{ marginBottom: "8px", fontWeight: 600, opacity: 0.7 }}
              >
                Your request:
              </div>
              <div>{chatState.input}</div>
            </BrutalistCard>
          )}

          {/* Streaming Display Section */}
          {sessionId && shouldGenerate && (
            <CreateWithStreaming
              sessionId={sessionId}
              promptText={chatState.input}
              onNavigateToPreview={handleNavigateToPreview}
              shouldGenerate={shouldGenerate}
              showInputAtBottom={true}
            />
          )}

          <a
            href="/"
            style={{ textAlign: "right", textDecoration: "underline" }}
          >
            Learn
          </a>
        </div>
      </div>

      <NeedsLoginModal />
    </div>
  );
};
