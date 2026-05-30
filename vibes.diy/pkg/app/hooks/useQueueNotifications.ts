import { useEffect, useRef } from "react";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";
import { defaultNotificationSettings, getNotificationSettings, type NotificationSettings } from "../lib/notification-settings.js";

interface UseQueueNotificationsArgs {
  vibeDiyApi: VibesDiyApiIface;
  enabled?: boolean;
}

function canNotifyNow(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted" &&
    !(document.visibilityState === "visible" && document.hasFocus())
  );
}

function openNotificationForPath(notification: Notification, path: string): void {
  notification.onclick = () => {
    window.focus();
    window.location.assign(path);
    notification.close();
  };
}

export function useQueueNotifications({ vibeDiyApi, enabled = true }: UseQueueNotificationsArgs): void {
  const notificationSettingsRef = useRef<NotificationSettings>(defaultNotificationSettings);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    void vibeDiyApi.ensureUserSettings({ settings: [] }).then((rSettings) => {
      if (cancelled || rSettings.isErr()) return;
      notificationSettingsRef.current = getNotificationSettings(rSettings.Ok().settings);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, vibeDiyApi]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const unsubs: (() => void)[] = [];

    unsubs.push(
      vibeDiyApi.onUserNotification((evt) => {
        if (!canNotifyNow()) return;

        if (evt.type === "vibes.diy.evt-new-fs-id") {
          if (!notificationSettingsRef.current.vibePublished) return;
          if (evt.mode === "dev") return;
          const path = `/chat/${evt.userSlug}/${evt.appSlug}`;
          const n = new Notification("Vibe published", {
            body: `${evt.userSlug}/${evt.appSlug}`,
            tag: `vibes-publish-${evt.userSlug}-${evt.appSlug}-${evt.fsId}`,
          });
          openNotificationForPath(n, path);
          return;
        }

        if (evt.type === "vibes.diy.evt-comment-posted") {
          if (!notificationSettingsRef.current.commentPosted) return;
          const path = `/chat/${evt.userSlug}/${evt.appSlug}`;
          const n = new Notification("New comment on your vibe", {
            body: `${evt.userSlug}/${evt.appSlug}`,
            tag: `vibes-comment-${evt.userSlug}-${evt.appSlug}-${evt.docId}`,
          });
          openNotificationForPath(n, path);
          return;
        }

        if (evt.type === "vibes.diy.evt-request-grant") {
          if (!notificationSettingsRef.current.accessRequestPending) return;
          if (evt.grant.state !== "approved" && evt.grant.state !== "revoked") return;

          const title = evt.grant.state === "approved" ? "Access request approved" : "Access request updated";
          const path = `/chat/${evt.grant.userSlug}/${evt.grant.appSlug}`;
          const n = new Notification(title, {
            body: `${evt.grant.userSlug}/${evt.grant.appSlug}`,
            tag: `vibes-request-${evt.grant.userSlug}-${evt.grant.appSlug}-${evt.grant.foreignUserId}-${evt.grant.state}`,
          });
          openNotificationForPath(n, path);
        }
      })
    );

    unsubs.push(
      vibeDiyApi.onRequestGrant((evt) => {
        if (evt.grant.state !== "pending") return;
        if (!notificationSettingsRef.current.accessRequestPending || !canNotifyNow()) return;
        const n = new Notification("New access request", {
          body: `${evt.grant.userSlug}/${evt.grant.appSlug}`,
          tag: `vibes-request-${evt.grant.userSlug}-${evt.grant.appSlug}-${evt.grant.foreignUserId}`,
        });
        openNotificationForPath(n, `/chat/${evt.grant.userSlug}/${evt.grant.appSlug}`);
      })
    );

    unsubs.push(
      vibeDiyApi.onInviteGrant((evt) => {
        if (evt.grant.state !== "accepted" || !canNotifyNow()) return;
        const n = new Notification("Invite accepted", {
          body: `${evt.grant.userSlug}/${evt.grant.appSlug}`,
          tag: `vibes-invite-${evt.grant.userSlug}-${evt.grant.appSlug}-${evt.grant.tokenOrGrantUserId}`,
        });
        openNotificationForPath(n, `/chat/${evt.grant.userSlug}/${evt.grant.appSlug}`);
      })
    );

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [enabled, vibeDiyApi]);
}
