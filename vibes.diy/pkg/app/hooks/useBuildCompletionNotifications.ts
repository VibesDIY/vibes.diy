import { useEffect, useRef } from "react";
import {
  defaultUserNotificationPreferences,
  EvtBuildComplete,
  UserNotificationPreferences,
  VibesDiyApiIface,
} from "@vibes.diy/api-types";

interface UseBuildCompletionNotificationsArgs {
  vibeDiyApi: VibesDiyApiIface;
  enabled?: boolean;
  thresholdMs?: number;
}

const DISMISSED_KEY = "vibes.buildNotifications.dismissed";
const PERMISSION_PROMPTED_KEY = "vibes.buildNotifications.permissionPrompted";
const DEFAULT_THRESHOLD_MS = 15_000;

function isPageVisibleAndFocused(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

function isNotificationApiAvailable(): boolean {
  return typeof window !== "undefined" && typeof Notification !== "undefined";
}

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // no-op
  }
}

function hasPromptedBefore(): boolean {
  try {
    return window.localStorage.getItem(PERMISSION_PROMPTED_KEY) === "1";
  } catch {
    return false;
  }
}

function markPrompted(): void {
  try {
    window.localStorage.setItem(PERMISSION_PROMPTED_KEY, "1");
  } catch {
    // no-op
  }
}

async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationApiAvailable()) return "denied";

  const current = Notification.permission;
  if (current === "granted" || current === "denied") return current;

  if (wasDismissed() || hasPromptedBefore()) return "default";

  markPrompted();
  const next = await Notification.requestPermission();
  if (next === "default") {
    markDismissed();
  }
  return next;
}

function isBuildTypeMuted(evt: EvtBuildComplete, prefs: UserNotificationPreferences): boolean {
  if (evt.status === "failed") {
    return !prefs.buildCompleteFailed;
  }
  return !prefs.buildCompleteSuccess;
}

export function useBuildCompletionNotifications({
  vibeDiyApi,
  enabled = true,
  thresholdMs = DEFAULT_THRESHOLD_MS,
}: UseBuildCompletionNotificationsArgs): void {
  const prefsRef = useRef<UserNotificationPreferences>(defaultUserNotificationPreferences);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    void vibeDiyApi.getUserNotificationPreferences({}).then((rPrefs) => {
      if (cancelled || rPrefs.isErr()) return;
      prefsRef.current = rPrefs.Ok().preferences;
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, vibeDiyApi]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!isNotificationApiAvailable()) return;

    const unsubscribe = vibeDiyApi.onBuildComplete((evt) => {
      if (typeof evt.durationMs === "number" && evt.durationMs < thresholdMs) {
        return;
      }

      if (isBuildTypeMuted(evt, prefsRef.current)) {
        return;
      }

      if (isPageVisibleAndFocused()) {
        return;
      }

      void (async () => {
        const permission = await ensureNotificationPermission();
        if (permission !== "granted") return;

        const title = evt.status === "failed" ? "Build failed" : "Build complete";
        const notification = new Notification(title, {
          body: `${evt.userSlug}/${evt.appSlug}`,
          tag: `vibes-build-${evt.promptId}`,
          requireInteraction: evt.status === "failed",
        });

        notification.onclick = () => {
          window.focus();
          const targetPath = `/chat/${evt.userSlug}/${evt.appSlug}`;
          if (window.location.pathname !== targetPath) {
            window.location.assign(targetPath);
          }
          notification.close();
        };
      })();
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, thresholdMs, vibeDiyApi]);
}
