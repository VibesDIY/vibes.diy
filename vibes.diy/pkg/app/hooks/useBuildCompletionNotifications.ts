import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { isUserSettingNotifications } from "@vibes.diy/api-types";
import type { NotificationRow, UserSettingNotifications } from "@vibes.diy/api-types";
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

export interface NotificationTypeConfig {
  prefKey: NotificationType;
  title: string;
  body: (u: string, a: string) => string;
  // Optional in-app path to open when the notification is clicked. Lets a click
  // on any device route to the relevant vibe instead of just focusing the window.
  // This slug-based form is what the browser-push handler can build (it only
  // receives ownerHandle/appSlug). For richer targetRef-aware deep links from
  // the inbox, use `pathForNotification(row)` below.
  path?: (u: string, a: string) => string;
}

export const TYPE_MAP: Record<string, NotificationTypeConfig> = {
  "build-complete": {
    prefKey: "buildComplete",
    title: "Build completed",
    body: (u, a) => `${u}/${a} build completed.`,
    path: (u, a) => `/vibe/${u}/${a}`,
  },
  "build-failed": {
    prefKey: "buildFailed",
    title: "Build failed",
    body: (u, a) => `${u}/${a} build failed.`,
    path: (u, a) => `/vibe/${u}/${a}`,
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
  "vibe-remixed": {
    prefKey: "vibeRemixed",
    title: "Vibe remixed",
    body: (u, a) => `Someone remixed your vibe ${u}/${a}.`,
    // Slug-based fallback: the subject vibe. The inbox prefers the remixer's
    // published remix via `pathForNotification` (targetRef.remixOwnerHandle /
    // remixAppSlug), which is the more useful destination.
    path: (u, a) => `/vibe/${u}/${a}`,
  },
  "dm-received": {
    prefKey: "dmReceived",
    title: "New message",
    body: (u, a) => `New message in ${u}/${a}.`,
    // Slug-based fallback to the Messages inbox; `pathForNotification` opens the
    // specific thread when targetRef.threadHandle is present.
    path: () => `/messages`,
  },
};

// targetRef shapes a renderer MAY hydrate. Both fields optional so a row whose
// linked object is gone still falls back to the slug-based `path`.
interface RemixTargetRef {
  remixOwnerHandle?: string;
  remixAppSlug?: string;
}
interface DmTargetRef {
  threadHandle?: string;
  docId?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// Resolve the best in-app destination for a persisted notification row. Prefers
// the type-specific `targetRef` deep link (e.g. the remixer's published remix,
// a DM thread); falls back to the slug-based `TYPE_MAP[...].path`. Returns
// undefined when neither applies (the row is then non-navigable).
export function pathForNotification(row: NotificationRow): string | undefined {
  const config = TYPE_MAP[row.notificationType];
  if (row.notificationType === "vibe-remixed" && isRecord(row.targetRef)) {
    const t = row.targetRef as RemixTargetRef;
    if (t.remixOwnerHandle && t.remixAppSlug) {
      return `/vibe/${t.remixOwnerHandle}/${t.remixAppSlug}`;
    }
  }
  if (row.notificationType === "dm-received" && isRecord(row.targetRef)) {
    const t = row.targetRef as DmTargetRef;
    if (t.threadHandle) {
      return `/messages/${row.ownerHandle}/${t.threadHandle}`;
    }
  }
  return config?.path?.(row.ownerHandle, row.appSlug);
}

export function useBuildCompletionNotifications(): void {
  const { vibeApi, sharedApi } = useVibesDiy();
  // Prefer the app-API (AppSessions) connection when one exists, otherwise use the
  // shared-plane connection (sharedApi). We deliberately never use the heavy codegen
  // chatApi here. On vibe routes sharedApi === vibeApi; on non-vibe routes sharedApi
  // is a SharedSessions WS at /api/shared (per-user shard for authed, global for anon).
  // Both serve the user-notification stream and ensureUserSettings (sharedHandlers).
  const api = vibeApi ?? sharedApi;
  const navigate = useNavigate();
  // The notification click fires long after render, so read navigate through a ref
  // to keep handleNotification (and the subscription) stable.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const permissionRequestedRef = useRef(false);
  const prefsRef = useRef<UserSettingNotifications>({ type: "notifications" });

  useEffect(() => {
    if (!api) return;
    void api.ensureUserSettings({ settings: [] }).then((res) => {
      if (res.isOk()) {
        const saved = res.Ok().settings.find(isUserSettingNotifications);
        if (saved) prefsRef.current = saved;
      }
    });
  }, [api]);

  const handleNotification = useCallback(async (evt: { notificationType: string; ownerHandle: string; appSlug: string }) => {
    const config = TYPE_MAP[evt.notificationType];
    if (config === undefined) return;
    if (prefsRef.current[config.prefKey] === false) return;
    if (!notificationsAvailable()) return;

    // Bail before requesting permission when this tab is visible and focused: we won't
    // show a notification anyway, and since build events are now delivered back to the
    // originating tab, prompting here would nag a user who is actively watching the build
    // (and a dismissed prompt gets permanently suppressed via writeSuppressed()).
    if (!document.hidden && document.hasFocus()) return;

    if (!permissionRequestedRef.current && Notification.permission === "default" && !readSuppressed()) {
      permissionRequestedRef.current = true;
      await maybeRequestPermission();
    }

    if (Notification.permission !== "granted") return;

    const notification = new Notification(config.title, {
      body: config.body(evt.ownerHandle, evt.appSlug),
      tag: `vibes-diy-${evt.notificationType}-${evt.ownerHandle}-${evt.appSlug}`,
    });

    notification.onclick = () => {
      window.focus();
      const path = config.path?.(evt.ownerHandle, evt.appSlug);
      if (path) {
        try {
          navigateRef.current(path);
        } catch {
          // Fall back to a full navigation if the SPA router isn't reachable.
          window.location.assign(path);
        }
      }
      notification.close();
    };
  }, []);

  useEffect(() => {
    if (!api?.onUserNotification) return;
    // Own the subscription here (the provider no longer eagerly subscribes chatApi),
    // so it rides whichever connection this page already has. Best-effort: the
    // reconnect loop re-subscribes once userNotificationSubscribed is set.
    void api.subscribeUserNotifications?.({}).catch((_e: unknown) => {
      /* best-effort — reconnect loop will retry */
    });
    return api.onUserNotification((evt) => {
      void handleNotification(evt);
    });
  }, [api, handleNotification]);
}
