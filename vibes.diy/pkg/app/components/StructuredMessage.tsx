import React, { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Segment, ViewType } from "@vibes.diy/prompts";
import { BrutalistCard } from "@vibes.diy/use-vibes-base";

interface StructuredMessageProps {
  segments: Segment[];
  isStreaming?: boolean;
  messageId?: string;
  setSelectedResponseId: (id: string) => void;
  selectedResponseId: string;
  setMobilePreviewShown: (shown: boolean) => void;
  rawText?: string; // Raw message text to be copied on shift+click
  navigateToView: (view: ViewType) => void; // Add ability to set active view
  isLatestMessage?: boolean; // Add prop to determine if this is the latest AI message
}

// Extracted CodeSegment as a separate component to avoid hooks in render functions
interface CodeSegmentProps {
  segment: Segment;
  index: number;
  codeReady: boolean;
  isSelected: boolean;
  messageId?: string;
  setSelectedResponseId: (id: string) => void;
  setMobilePreviewShown: (shown: boolean) => void;
  codeLines: number;
  rawText?: string; // Raw message text to be copied on shift+click
  navigateToView: (view: ViewType) => void; // Add ability to set active view
}

const CodeSegment = ({
  segment,
  index,
  codeReady,
  isSelected,
  messageId,
  setSelectedResponseId,
  setMobilePreviewShown,
  codeLines,
  rawText,
  navigateToView,
}: CodeSegmentProps) => {
  const content = segment.content || "";
  const codeSegmentRef = useRef<HTMLDivElement>(null);

  // Handle click on code segments to select the response
  const handleCodeClick = () => {
    if (messageId) {
      setSelectedResponseId(messageId);
    }

    // Always show mobile preview and set to code view regardless of selection state
    // This ensures we can always enter code view by clicking a code segment
    setMobilePreviewShown(true);

    // Always navigate to code view when clicking on a code segment
    if (navigateToView) {
      navigateToView("preview");
    }
  };

  return (
    <BrutalistCard
      ref={codeSegmentRef}
      size="sm"
      data-code-segment={index}
      style={{
        position: "sticky",
        top: "8px",
        zIndex: 10,
      }}
      className="sticky-active relative mx-3 my-4 cursor-pointer transition-all"
      onClick={handleCodeClick}
    >
      <div
        className={`absolute -top-1 left-1 text-lg ${
          !codeReady
            ? "text-orange-500 dark:text-orange-400"
            : isSelected
              ? "text-green-500 dark:text-green-400"
              : "text-accent-01 dark:text-accent-02"
        }`}
      >
        •
      </div>
      <div className="flex items-center justify-between rounded-sm p-2">
        <span className="text-accent-01 dark:text-accent-01 font-mono text-sm">
          {`${codeLines} line${codeLines !== 1 ? "s" : ""}`}
        </span>
        <button
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation(); // Prevent triggering the parent's onClick
            // If shift key is pressed, copy the raw message text instead of just the code
            const textToCopy = e.shiftKey && rawText ? rawText : content;
            navigator.clipboard.writeText(textToCopy);
          }}
          className="bg-light-background-02 hover:accent-00 dark:bg-dark-background-01 dark:hover:bg-dark-decorative-00 text-accent-01 hover:text-accent-02 dark:text-accent-01 dark:hover:text-dark-secondary rounded-sm px-2 py-1 text-sm transition-colors active:bg-orange-400 active:text-orange-800 dark:active:bg-orange-600 dark:active:text-orange-200"
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

      {/* Code preview with height transition instead of conditional rendering */}
      <div
        className={`bg-light-background-02 dark:bg-dark-background-01 m-0 h-0 max-h-0 min-h-0 overflow-hidden rounded-sm border-0 p-0 font-mono text-sm opacity-0 shadow-inner transition-all`}
      >
        {content
          .split("\n")
          .slice(0, 3)
          .map((line, i) => (
            <div
              key={i}
              className="text-light-primary dark:text-dark-secondary truncate"
            >
              {line || " "}
            </div>
          ))}
        {content.split("\n").length > 3 && (
          <div className="text-accent-01 dark:text-accent-01">...</div>
        )}
      </div>
    </BrutalistCard>
  );
};

/**
 * Component for displaying structured messages with markdown and code segments
 */
const StructuredMessage = ({
  segments,
  isStreaming,
  messageId,
  setSelectedResponseId,
  selectedResponseId,
  setMobilePreviewShown,
  rawText,
  navigateToView,
  isLatestMessage = false, // Default to false if not provided
}: StructuredMessageProps) => {
  // Ensure segments is an array (defensive)
  const validSegments = Array.isArray(segments) ? segments : [];

  // Calculate local codeReady state based on segments.length > 2 or !isStreaming
  const codeReady = validSegments.length > 2 || isStreaming === false;

  // Check if this message is currently selected by direct ID comparison
  const isSelected = messageId === selectedResponseId;

  // Count number of lines in code segments
  const codeLines = validSegments
    .filter((segment) => segment.type === "code")
    .reduce(
      (acc, segment) => acc + (segment.content?.split("\n").length || 0),
      0,
    );

  // CRITICAL: We always want to show something if there's any content at all
  const hasContent =
    validSegments.length > 0 &&
    validSegments.some(
      (segment) => segment?.content && segment.content.trim().length > 0,
    );

  // Add CSS for sticky elements
  useEffect(() => {
    // Add CSS rules for sticky elements if they don't exist yet
    if (!document.getElementById("sticky-segment-styles")) {
      const styleEl = document.createElement("style");
      styleEl.id = "sticky-segment-styles";
      styleEl.textContent = `
          .sticky-active {
            padding: 8px !important;
            transition: all 0.8s ease-in-out;
          }
          
          [data-code-segment] {
            transition: all 0.8s ease-in-out;
          }
          
          [data-code-segment] > div {
            transition: all 0.8s ease-in-out;
          }
        `;
      document.head.appendChild(styleEl);
    }

    return () => {
      // Clean up the style element when component unmounts
      const styleEl = document.getElementById("sticky-segment-styles");
      if (styleEl) {
        styleEl.remove();
      }
    };
  }, []);

  return (
    <div
      className="structured-message"
      style={{ overflow: "visible", position: "relative" }}
    >
      {!hasContent ? (
        // Show placeholder if there are no segments with content
        <div className="prose prose-sm dark:prose-invert prose-ul:pl-5 prose-ul:list-disc prose-ol:pl-5 prose-ol:list-decimal prose-li:my-0 max-w-none">
          <p>Processing response...</p>
        </div>
      ) : (
        // Map and render each segment that has content
        validSegments
          .filter((segment): segment is Segment =>
            Boolean(segment?.content && segment.content.trim().length > 0),
          )
          .map((segment, index) => {
            if (segment.type === "markdown") {
              return (
                <BrutalistCard key={`markdown-${index}`} size="sm" className="my-4">
                  <div className="prose prose-sm dark:prose-invert prose-ul:pl-5 prose-ul:list-disc prose-ol:pl-5 prose-ol:list-decimal prose-li:my-0 max-w-none">
                    <ReactMarkdown>{segment.content || ""}</ReactMarkdown>
                  </div>
                </BrutalistCard>
              );
            } else if (segment.type === "code") {
              return (
                <CodeSegment
                  key={`code-${index}`}
                  segment={segment}
                  index={index}
                  codeReady={codeReady}
                  isSelected={isSelected}
                  messageId={messageId}
                  setSelectedResponseId={setSelectedResponseId}
                  setMobilePreviewShown={setMobilePreviewShown}
                  codeLines={codeLines}
                  rawText={rawText}
                  navigateToView={navigateToView}
                />
              );
            }
            return null;
          })
      )}

      {/* Show streaming indicator only when this is the latest message, streaming is active, and we already have content */}
      {isStreaming && hasContent && isLatestMessage && (
        <span className="bg-light-primary dark:bg-dark-primary ml-1 inline-block h-4 w-2 animate-pulse" />
      )}
    </div>
  );
};

export default StructuredMessage;
