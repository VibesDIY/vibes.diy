import { useRef, useCallback, useEffect } from "react";

/**
 * Hook for managing throttled AI message updates based on line count changes
 * @param mergeAiMessage - Function to update AI message content
 * @returns Object with throttled update function and refs
 */
export function useThrottledUpdates(
  mergeAiMessage: (update: { text: string }) => void,
) {
  const isProcessingRef = useRef<boolean>(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousContentRef = useRef<string>("");

  const throttledMergeAiMessage = useCallback(
    (content: string) => {
      // If we're already processing a database operation, don't trigger more updates
      if (isProcessingRef.current) {
        return;
      }

      // Clear any pending timeout to implement proper debouncing
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }

      // Line-based throttle parameters
      const MIN_LINE_THRESHOLD = 3; // Minimum lines changed before triggering update
      const MAX_LINES_BUFFER = 10; // Maximum lines to buffer before forcing an update
      const FALLBACK_DELAY = 100; // Small delay for batching if line threshold not met

      // Count new lines since last update
      const previousContent = previousContentRef.current;
      const previousLineCount = previousContent.split("\n").length;
      const currentLineCount = content.split("\n").length;
      const linesDifference = Math.abs(currentLineCount - previousLineCount);

      // Determine if we should update based on line count
      const shouldUpdate =
        linesDifference >= MIN_LINE_THRESHOLD ||
        currentLineCount >= MAX_LINES_BUFFER ||
        (content !== previousContent &&
          currentLineCount >= 1 &&
          previousContent === "");

      // Set delay based on whether we've crossed the line threshold
      const delay = shouldUpdate ? 0 : FALLBACK_DELAY;

      // Schedule update with calculated delay
      updateTimeoutRef.current = setTimeout(() => {
        // Save the current content as previous for next comparison
        previousContentRef.current = content;

        // Update with the content passed directly to this function
        mergeAiMessage({ text: content });
      }, delay);
    },
    [mergeAiMessage],
  );

  // Cleanup any pending updates when the component unmounts
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, []);

  return { throttledMergeAiMessage, isProcessingRef, updateTimeoutRef };
}
