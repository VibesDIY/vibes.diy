import { useState, useRef, useEffect, useCallback } from "react";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";

interface UseShareModalParams {
  userSlug: string;
  appSlug: string;
  fsId: string | undefined;
  vibeDiyApi: VibesDiyApiIface;
}

interface UseShareModalReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  isPublished: boolean;
  isPublishing: boolean;
  isUpToDate: boolean;
  publishError: string | undefined;
  publishedUrl: string | undefined;
  handlePublish: (autoJoin: boolean) => Promise<void>;
  autoJoinEnabled: boolean;
  isTogglingAutoJoin: boolean;
  handleToggleAutoJoin: () => Promise<void>;
  urlCopied: boolean;
  handleCopyUrl: () => Promise<void>;
  canPublish: boolean;
  settingsLoaded: boolean;
}

export type { UseShareModalReturn };

export function useShareModal({ userSlug, appSlug, fsId, vibeDiyApi }: UseShareModalParams): UseShareModalReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | undefined>(undefined);
  const [publishedUrl, setPublishedUrl] = useState<string | undefined>(undefined);
  const [productionFsId, setProductionFsId] = useState<string | undefined>(undefined);
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isTogglingAutoJoin, setIsTogglingAutoJoin] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const canPublish = fsId !== undefined && fsId !== "";
  const isUpToDate = isPublished && productionFsId === fsId;

  function clearCopyTimeout() {
    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
  }

  function open() {
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setPublishError(undefined);
    clearCopyTimeout();
  }

  // Fetch current production state and settings when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    // Reset all derived state before fetching
    setIsPublished(false);
    setProductionFsId(undefined);
    setPublishedUrl(undefined);
    setUrlCopied(false);
    setPublishError(undefined);
    setAutoJoinEnabled(false);
    setSettingsLoaded(false);
    clearCopyTimeout();

    // Check if app has a production version
    vibeDiyApi
      .getAppByFsId({ appSlug, userSlug })
      .then((res) => {
        if (cancelled) return;
        if (res.isOk()) {
          const app = res.Ok();
          if (app.mode === "production" && app.fsId) {
            setIsPublished(true);
            setProductionFsId(app.fsId);
            setPublishedUrl(`${window.location.origin}/vibe/${userSlug}/${appSlug}/`);
          }
        }
      })
      .catch(() => {
        // App may not exist yet — defaults apply
      });

    // Fetch sharing settings
    vibeDiyApi
      .ensureAppSettings({ appSlug, userSlug })
      .then((res) => {
        if (cancelled) return;
        if (res.isOk()) {
          setAutoJoinEnabled(!!res.Ok().settings.entry.enableRequest?.autoAcceptRole);
        }
      })
      .catch(() => {
        // New app with no settings yet — defaults apply
      })
      .finally(() => {
        if (!cancelled) setSettingsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, appSlug, userSlug, vibeDiyApi]);

  const handlePublish = useCallback(
    async (autoJoin: boolean) => {
      if (!canPublish || !settingsLoaded) return;
      const isInitialPublish = !isPublished;
      setIsPublishing(true);
      setPublishError(undefined);

      try {
        const modeResult = await vibeDiyApi.setSetModeFs({
          fsId: fsId as string,
          appSlug,
          userSlug,
          mode: "production",
        });

        if (!modeResult.isOk()) {
          setPublishError("Failed to publish. Please try again.");
          return;
        }

        const settingsResult = await vibeDiyApi.ensureAppSettings({
          appSlug,
          userSlug,
          request: { enable: true, autoAcceptRole: autoJoin ? "viewer" : undefined },
        });

        if (!settingsResult.isOk()) {
          setPublishError("Published, but failed to update sharing settings.");
        } else {
          setAutoJoinEnabled(autoJoin);
        }

        const url = `${window.location.origin}/vibe/${userSlug}/${appSlug}/`;
        setPublishedUrl(url);
        setProductionFsId(fsId);
        setIsPublished(true);

        if (isInitialPublish) {
          window.open(url, "_blank");
        }
      } catch {
        setPublishError("Failed to publish. Please try again.");
      } finally {
        setIsPublishing(false);
      }
    },
    [canPublish, settingsLoaded, isPublished, fsId, appSlug, userSlug, vibeDiyApi]
  );

  const handleToggleAutoJoin = useCallback(async () => {
    setIsTogglingAutoJoin(true);
    const nextValue = !autoJoinEnabled;
    try {
      const result = await vibeDiyApi.ensureAppSettings({
        appSlug,
        userSlug,
        request: { enable: true, autoAcceptRole: nextValue ? "viewer" : undefined },
      });
      if (result.isOk()) {
        setAutoJoinEnabled(nextValue);
      }
    } finally {
      setIsTogglingAutoJoin(false);
    }
  }, [autoJoinEnabled, appSlug, userSlug, vibeDiyApi]);

  const handleCopyUrl = useCallback(async () => {
    if (!publishedUrl) return;
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setUrlCopied(true);
      clearCopyTimeout();
      copyTimeoutRef.current = window.setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      setPublishError("Could not copy link.");
    }
  }, [publishedUrl]);

  return {
    isOpen,
    open,
    close,
    buttonRef,
    isPublished,
    isPublishing,
    isUpToDate,
    publishError,
    publishedUrl,
    handlePublish,
    autoJoinEnabled,
    isTogglingAutoJoin,
    handleToggleAutoJoin,
    urlCopied,
    handleCopyUrl,
    canPublish,
    settingsLoaded,
  };
}
