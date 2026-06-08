import { useCallback, useEffect, useRef } from "react";
import { isUserSettingNotifications } from "@vibes.diy/api-types";
import type { UserSettingNotifications } from "@vibes.diy/api-types";
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

type NotificationType = keyof Omit<UserSettingNotifications, "type">;

const TYPE_MAP: Record<string, { prefKey: NotificationType; title: string; body: (u: string, a: string) => string }> = {
  "build-complete": {
    prefKey: "buildComplete",
    title: "Build completed",
    body: (u, a) => `${u}/${a} build completed.`,
  },
  "build-failed": {
    prefKey: "buildFailed",
    title: "Build failed",
    body: (u, a) => `${u}/${a} build failed.`,
  },
  "vibe-published": {
    prefKey: "vibePublished",
    title: "Vibe published",
    body: (u, a) => `${u}/${a} was published.`,
  },
  "comment-posted": {
    prefKey: "commentPosted",
    title: "New comment",
    body: (u, a) => `New comment on ${u}/${a}.`,
  },
  "request-approved": {
    prefKey: "requestApproved",
    title: "Access approved",
    body: (u, a) => `Access to ${u}/${a} approved.`,
  },
  "request-revoked": {
    prefKey: "requestRevoked",
    title: "Access revoked",
    body: (u, a) => `Access to ${u}/${a} was revoked.`,
  },
};

export function useBuildCompletionNotifications(): void {
  const { chatApi } = useVibesDiy();
  const permissionRequestedRef = useRef(false);
  const prefsRef = useRef<UserSettingNotifications>({ type: "notifications" });

  useEffect(() => {
    void chatApi.ensureUserSettings({ settings: [] }).then((res) => {
      if (res.isOk()) {
        const saved = res.Ok().settings.find(isUserSettingNotifications);
        if (saved) prefsRef.current = saved;
      }
    });
  }, [chatApi]);

  const handleNotification = useCallback(async (evt: { notificationType: string; ownerHandle: string; appSlug: string }) => {
    const config = TYPE_MAP[evt.notificationType];
    if (config === undefined) return;
    if (prefsRef.current[config.prefKey] === false) return;
    if (!notificationsAvailable()) return;

    if (!permissionRequestedRef.current && Notification.permission === "default" && !readSuppressed()) {
      permissionRequestedRef.current = true;
      await maybeRequestPermission();
    }

    if (Notification.permission !== "granted") return;
    if (!document.hidden && document.hasFocus()) return;

    const notification = new Notification(config.title, {
      body: config.body(evt.ownerHandle, evt.appSlug),
      tag: `vibes-diy-${evt.notificationType}-${evt.ownerHandle}-${evt.appSlug}`,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }, []);

  useEffect(() => {
    if (!chatApi?.onUserNotification) return;
    return chatApi.onUserNotification((evt) => {
      void handleNotification(evt);
    });
  }, [chatApi, handleNotification]);
}
