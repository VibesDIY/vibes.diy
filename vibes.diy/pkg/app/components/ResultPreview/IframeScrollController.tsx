import { useEffect, useRef } from "react";

// Create static refs that persist across component remounts
// These will maintain state even when the component is unmounted and remounted
const staticRefs = {
  scroller: null as HTMLElement | null,
  contentObserver: null as MutationObserver | null,
  checkForScrollerInterval: null as NodeJS.Timeout | null,
  lastScrollHeight: 0,
};

interface SandpackScrollControllerProps {
  isStreaming: boolean;
  shouldEnableScrolling?: boolean;
  codeReady?: boolean;
  activeView?: "preview" | "code";
}

const SandpackScrollController: React.FC<SandpackScrollControllerProps> = ({
  isStreaming,
  // shouldEnableScrolling = isStreaming, // Default to isStreaming if not provided
  codeReady = false,
  activeView = "preview", // Default to preview view
}) => {
  // Keep component-level refs for React's hook rules
  const componentMounted = useRef(false);
  const propsRef = useRef({ isStreaming, codeReady, activeView });

  // Update props ref when they change
  useEffect(() => {
    propsRef.current = { isStreaming, codeReady, activeView };
  }, [isStreaming, codeReady, activeView]);

  // Simple check if we should be auto-scrolling
  const shouldAutoScroll = () => {
    const { isStreaming, codeReady, activeView } = propsRef.current;
    return isStreaming && !codeReady && activeView === "code";
  };

  // Immediately scroll to the bottom with no animations
  const scrollToBottom = () => {
    if (!staticRefs.scroller) return;

    // Hard scroll to bottom with no animation
    staticRefs.scroller.scrollTop = staticRefs.scroller.scrollHeight;
    staticRefs.lastScrollHeight = staticRefs.scroller.scrollHeight;
  };

  // Setup the scroller observer
  const setupScroller = (scroller: HTMLElement) => {
    if (!scroller) return;

    staticRefs.scroller = scroller;

    // Clean up any previous observers
    if (staticRefs.contentObserver) {
      staticRefs.contentObserver.disconnect();
    }

    // Setup content observer with simplified mutation handling
    const contentObserver = new MutationObserver(() => {
      // Skip if component not mounted or no scroller
      if (!componentMounted.current || !staticRefs.scroller) return;

      // Check if content height has changed
      const newHeight = staticRefs.scroller.scrollHeight;
      if (newHeight !== staticRefs.lastScrollHeight && shouldAutoScroll()) {
        scrollToBottom();
      }

      staticRefs.lastScrollHeight = newHeight;
    });

    // Observe all relevant content changes
    contentObserver.observe(scroller, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    staticRefs.contentObserver = contentObserver;

    // Do initial scroll if needed
    if (shouldAutoScroll()) {
      scrollToBottom();
    }
  };

  // Main effect to handle mounting and setup
  useEffect(() => {
    componentMounted.current = true;

    // Add the highlight styles if they don't exist (for test compatibility)
    if (!document.getElementById("highlight-style")) {
      const style = document.createElement("style");
      style.id = "highlight-style";
      style.textContent = `
        .cm-line-highlighted {
          position: relative !important;
          border-left: 3px solid rgba(0, 137, 249, 0.6) !important;
          color: inherit !important;
          transition: border-color 0.4s ease-in-out !important;
        }
        
        .cm-line-highlighted::before {
          content: "" !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          background: linear-gradient(
            90deg, 
            rgba(0, 128, 255, 0.12) 0%, 
            rgba(224, 255, 255, 0.2) 50%, 
            rgba(0, 183, 255, 0.12) 100%
          ) !important;
          background-size: 200% 100% !important;
          pointer-events: none !important;
          z-index: -1 !important;
          opacity: 0 !important;
          transition: opacity 1ms ease-in-out !important;
        }
        
        /* Simple animation for all document sizes */
        .cm-line-highlighted.active::before {
          opacity: 1 !important;
          animation: sparkleFlow 2s ease-in-out infinite !important;
        }
        
        /* Simple animation keyframes */
        @keyframes sparkleFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        /* Fade out class with transition */
        .cm-line-fade-out {
          transition: border-color 1.5s cubic-bezier(0.25, 0.1, 0.25, 1) !important;
          border-left-color: rgba(0, 137, 249, 0.2) !important;
        }
        
        .cm-line-fade-out::before {
          opacity: 0 !important;
          transition: opacity 1.5s cubic-bezier(0.25, 0.1, 0.1, 1) !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Find the scroller element
    const findAndSetupScroller = () => {
      const scroller = document.querySelector(".cm-scroller");
      if (scroller && scroller instanceof HTMLElement) {
        setupScroller(scroller);
        return true;
      }
      return false;
    };

    // Try to find scroller immediately
    if (!findAndSetupScroller()) {
      // If not found, set up an interval to keep trying
      staticRefs.checkForScrollerInterval = setInterval(() => {
        if (findAndSetupScroller()) {
          // Once found, clear the interval
          if (staticRefs.checkForScrollerInterval) {
            clearInterval(staticRefs.checkForScrollerInterval);
            staticRefs.checkForScrollerInterval = null;
          }
        }
      }, 100);
    }

    // Cleanup function
    return () => {
      componentMounted.current = false;

      // Clear intervals
      if (staticRefs.checkForScrollerInterval) {
        clearInterval(staticRefs.checkForScrollerInterval);
        staticRefs.checkForScrollerInterval = null;
      }

      // Disconnect observer
      if (staticRefs.contentObserver) {
        staticRefs.contentObserver.disconnect();
      }
    };
  }, []);

  // Effect for responding to prop changes
  useEffect(() => {
    // If conditions change and we should auto-scroll now, do it
    if (shouldAutoScroll() && staticRefs.scroller) {
      scrollToBottom();
    }
  }, [isStreaming, codeReady, activeView]);

  return null;
};

export default SandpackScrollController;
