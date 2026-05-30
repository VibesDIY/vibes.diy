import { useEffect, useRef } from "react";
import { defaultUserNotificationPreferences, UserNotificationPreferences, VibesDiyApiIface } from "@vibes.diy/api-types";

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

export function useQueueNotifications({ vibeDiyApi, enabled = true }: UseQueueNotificationsArgs): void {
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

    const unsubs: (() => void)[] = [];

    unsubs.push(
      vibeDiyApi.onCommentPosted((evt) => {
        if (!prefsRef.current.commentPosted || !canNotifyNow()) return;
        const n = new Notification("New comment on your vibe", {
          body: `${evt.userSlug}/${evt.appSlug}`,
          tag: `vibes-comment-${evt.userSlug}-${evt.appSlug}-${evt.docId}`,
        });
        n.onclick = () => {
          window.focus();
          window.location.assign(`/chat/${evt.userSlug}/${evt.appSlug}`);
          n.close();
        };
      })
    );

    unsubs.push(
      vibeDiyApi.onRequestGrant((evt) => {
        if (evt.grant.state !== "pending") return;
        if (!prefsRef.current.accessRequestPending || !canNotifyNow()) return;
        const n = new Notification("New access request", {
          body: `${evt.grant.userSlug}/${evt.grant.appSlug}`,
          tag: `vibes-request-${evt.grant.userSlug}-${evt.grant.appSlug}-${evt.grant.foreignUserId}`,
        });
        n.onclick = () => {
          window.focus();
          window.location.assign(`/chat/${evt.grant.userSlug}/${evt.grant.appSlug}`);
          n.close();
        };
      })
    );

    unsubs.push(
      vibeDiyApi.onInviteGrant((evt) => {
        if (evt.grant.state !== "accepted" || !canNotifyNow()) return;
        const n = new Notification("Invite accepted", {
          body: `${evt.grant.userSlug}/${evt.grant.appSlug}`,
          tag: `vibes-invite-${evt.grant.userSlug}-${evt.grant.appSlug}-${evt.grant.tokenOrGrantUserId}`,
        });
        n.onclick = () => {
          window.focus();
          window.location.assign(`/chat/${evt.grant.userSlug}/${evt.grant.appSlug}`);
          n.close();
        };
      })
    );

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [enabled, vibeDiyApi]);
}
