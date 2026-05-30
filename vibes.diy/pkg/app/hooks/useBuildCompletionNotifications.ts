import { useEffect, useRef } from "react";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";
import { defaultNotificationSettings, getNotificationSettings, type NotificationSettings } from "../lib/notification-settings.js";

interface UseBuildCompletionNotificationsArgs {
  vibeDiyApi: VibesDiyApiIface;
  enabled?: boolean;
  thresholdMs?: number;
}

interface PromptLifecycleState {
  startedAtMs: number;
  failed: boolean;
}

const DEFAULT_THRESHOLD_MS = 15_000;
const MAX_TRACKED_COMPLETIONS = 500;

function isPageVisibleAndFocused(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}

function isNotificationApiAvailable(): boolean {
  return typeof window !== "undefined" && typeof Notification !== "undefined";
}

function toTimestampMs(value: Date | string): number {
  const ts = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ts) ? ts : Date.now();
}

async function ensureNotificationPermission(promptedRef: { current: boolean }): Promise<NotificationPermission> {
  if (!isNotificationApiAvailable()) return "denied";

  const current = Notification.permission;
  if (current === "granted" || current === "denied") return current;

  if (promptedRef.current) return "default";

  promptedRef.current = true;
  return Notification.requestPermission();
}

export function useBuildCompletionNotifications({
  vibeDiyApi,
  enabled = true,
  thresholdMs = DEFAULT_THRESHOLD_MS,
}: UseBuildCompletionNotificationsArgs): void {
  const notificationSettingsRef = useRef<NotificationSettings>(defaultNotificationSettings);
  const promptStateRef = useRef<Map<string, PromptLifecycleState>>(new Map());
  const completionKeysRef = useRef<Set<string>>(new Set());
  const permissionPromptedRef = useRef(false);

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
    if (!isNotificationApiAvailable()) return;

    const unsubscribe = vibeDiyApi.onUserNotification((evt) => {
      if (evt.type !== "vibes.diy.section-event") return;

      for (const block of evt.blocks) {
        if (block.type === "prompt.block-begin") {
          promptStateRef.current.set(evt.promptId, {
            startedAtMs: toTimestampMs(block.timestamp),
            failed: false,
          });
          continue;
        }

        if (block.type === "prompt.error") {
          const existing = promptStateRef.current.get(evt.promptId);
          promptStateRef.current.set(evt.promptId, {
            startedAtMs: existing?.startedAtMs ?? toTimestampMs(block.timestamp),
            failed: true,
          });
          continue;
        }

        if (block.type !== "prompt.block-end") {
          continue;
        }

        const completionKey = `${evt.promptId}:${evt.blockSeq}:${block.seq}`;
        if (completionKeysRef.current.has(completionKey)) {
          continue;
        }
        completionKeysRef.current.add(completionKey);
        if (completionKeysRef.current.size > MAX_TRACKED_COMPLETIONS) {
          completionKeysRef.current.clear();
          completionKeysRef.current.add(completionKey);
        }

        const promptState = promptStateRef.current.get(evt.promptId);
        promptStateRef.current.delete(evt.promptId);
        if (!promptState) {
          continue;
        }

        const durationMs = toTimestampMs(block.timestamp) - promptState.startedAtMs;
        if (durationMs < thresholdMs) {
          continue;
        }

        const isFailed = promptState.failed;
        const settings = notificationSettingsRef.current;
        if (isFailed ? !settings.buildFailed : !settings.buildComplete) {
          continue;
        }

        if (isPageVisibleAndFocused()) {
          continue;
        }

        void (async () => {
          const permission = await ensureNotificationPermission(permissionPromptedRef);
          if (permission !== "granted") return;

          const title = isFailed ? "Build failed" : "Build complete";
          const notification = new Notification(title, {
            body: "Click to return to Vibes DIY",
            tag: `vibes-build-${evt.promptId}`,
            requireInteraction: isFailed,
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        })();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, thresholdMs, vibeDiyApi]);
}
