import { useCallback, useEffect, useRef } from "react";

const DEFAULT_NOTIFICATION_THRESHOLD_MS = 15_000;
const STORAGE_KEY_SUPPRESSED = "vibes.diy.build-complete-notifications.suppressed";

export interface UseBuildCompletionNotificationsArgs {
  buildRunning: boolean;
  buildFailed: boolean;
  appTitle: string;
  thresholdMs?: number;
}

function notificationsAvailable(): boolean {
  return typeof window !== "undefined" && typeof Notification !== "undefined";
}

function readSuppressed(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY_SUPPRESSED) === "1";
  } catch {
    return false;
  }
}

function writeSuppressed(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_SUPPRESSED, "1");
  } catch {
    // Ignore storage failures (privacy mode, quota, etc.).
  }
}

export function useBuildCompletionNotifications({
  buildRunning,
  buildFailed,
  appTitle,
  thresholdMs = DEFAULT_NOTIFICATION_THRESHOLD_MS,
}: UseBuildCompletionNotificationsArgs): void {
  const wasRunningRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const permissionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPermissionTimer = useCallback(() => {
    if (permissionTimerRef.current !== null) {
      clearTimeout(permissionTimerRef.current);
      permissionTimerRef.current = null;
    }
  }, []);

  const maybeRequestPermission = useCallback(async (): Promise<NotificationPermission | null> => {
    if (!notificationsAvailable()) return null;

    const current = Notification.permission;
    if (current !== "default") return current;
    if (readSuppressed()) return current;

    const next = await Notification.requestPermission().catch(() => "default" as NotificationPermission);
    if (next === "default") {
      writeSuppressed();
    }
    return next;
  }, []);

  const sendCompletionNotification = useCallback(() => {
    if (!notificationsAvailable()) return;
    if (Notification.permission !== "granted") return;
    if (!document.hidden && document.hasFocus()) return;

    const status = buildFailed ? "failed" : "completed";
    const notification = new Notification(`Build ${status}`, {
      body: `${appTitle} build ${status}.`,
      tag: "vibes-diy-build-complete",
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }, [appTitle, buildFailed]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const wasRunning = wasRunningRef.current;
    if (!wasRunning && buildRunning) {
      wasRunningRef.current = true;
      startedAtRef.current = Date.now();
      clearPermissionTimer();
      permissionTimerRef.current = setTimeout(() => {
        void maybeRequestPermission();
      }, thresholdMs);
      return;
    }

    if (wasRunning && !buildRunning) {
      wasRunningRef.current = false;
      clearPermissionTimer();

      const startedAt = startedAtRef.current;
      startedAtRef.current = null;
      if (startedAt === null) return;

      if (Date.now() - startedAt < thresholdMs) return;

      void (async () => {
        const permission = await maybeRequestPermission();
        if (permission !== "granted") return;
        sendCompletionNotification();
      })();
    }
  }, [buildRunning, thresholdMs, clearPermissionTimer, maybeRequestPermission, sendCompletionNotification]);

  useEffect(
    () => () => {
      clearPermissionTimer();
    },
    [clearPermissionTimer]
  );
}
