import { useEffect, useRef, useState } from "react";

interface UseAutoProgressAnimationOptions {
  enabled: boolean; // Whether to run the auto-progress (e.g., only on mobile)
  durationMs?: number; // Total duration for one complete cycle (0-100)
  fps?: number; // Frames per second
  pauseBeforeRestartMs?: number; // Pause duration before restarting the loop
}

/**
 * Hook to automatically cycle animation progress from 0 to 100 and loop
 * Used for mobile version of animated sections
 */
export function useAutoProgressAnimation({
  enabled,
  durationMs = 30000, // Default: 30 seconds for full cycle
  fps = 60, // Default: 60fps
  pauseBeforeRestartMs = 500, // Default: 500ms pause before restart
}: UseAutoProgressAnimationOptions): number {
  const [progress, setProgress] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(Date.now());
  const accumulatedTimeRef = useRef<number>(0);
  const pauseTimeoutRef = useRef<number | null>(null);
  const isPausedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) {
      setProgress(0);
      return;
    }

    const frameInterval = 1000 / fps; // milliseconds per frame
    const progressPerMs = 100 / durationMs; // how much progress per millisecond

    const animate = () => {
      if (isPausedRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const now = Date.now();
      const deltaTime = now - lastTimeRef.current;
      lastTimeRef.current = now;

      accumulatedTimeRef.current += deltaTime;

      // Only update if enough time has passed for the next frame
      if (accumulatedTimeRef.current >= frameInterval) {
        setProgress((prev) => {
          const newProgress = prev + progressPerMs * accumulatedTimeRef.current;
          accumulatedTimeRef.current = 0;

          // When reaching the end, pause before restarting
          if (newProgress >= 100) {
            isPausedRef.current = true;
            pauseTimeoutRef.current = window.setTimeout(() => {
              isPausedRef.current = false;
              setProgress(0);
              lastTimeRef.current = Date.now();
            }, pauseBeforeRestartMs);
            return 100; // Hold at 100 during pause
          }

          return newProgress;
        });
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    lastTimeRef.current = Date.now();
    accumulatedTimeRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (pauseTimeoutRef.current !== null) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, [enabled, durationMs, fps, pauseBeforeRestartMs]);

  return progress;
}
