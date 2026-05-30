import { useCallback, useEffect, useRef } from "react";
import { useVibesDiy } from "../vibes-diy-provider.js";

const STORAGE_KEY_SUPPRESSED = "vibes.diy.build-complete-notifications.suppressed";

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

const maybeRequestPermission = async (): Promise<NotificationPermission | null> => {
  if (!notificationsAvailable()) return null;

  const current = Notification.permission;
  if (current !== "default") return current;
  if (readSuppressed()) return current;

  const next = await Notification.requestPermission().catch(() => "default" as NotificationPermission);
  if (next === "default") {
    writeSuppressed();
  }
  return next;
};

export function useBuildCompletionNotifications(): void {
  const { vibeDiyApi } = useVibesDiy();
  const permissionRequestedRef = useRef(false);

  const handleNotification = useCallback(async (evt: { notificationType: string; userSlug: string; appSlug: string }) => {
    if (evt.notificationType !== "build-complete" && evt.notificationType !== "build-failed") return;
    if (!notificationsAvailable()) return;

    // Request permission once if not yet determined.
    if (!permissionRequestedRef.current && Notification.permission === "default" && !readSuppressed()) {
      permissionRequestedRef.current = true;
      await maybeRequestPermission();
    }

    if (Notification.permission !== "granted") return;
    if (!document.hidden && document.hasFocus()) return;

    const status = evt.notificationType === "build-failed" ? "failed" : "completed";
    const notification = new Notification(`Build ${status}`, {
      body: `${evt.userSlug}/${evt.appSlug} build ${status}.`,
      tag: `vibes-diy-build-${evt.userSlug}-${evt.appSlug}`,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }, []);

  useEffect(() => {
    if (!vibeDiyApi?.onUserNotification) return;
    return vibeDiyApi.onUserNotification((evt) => {
      void handleNotification(evt);
    });
  }, [vibeDiyApi, handleNotification]);
}
