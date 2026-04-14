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
  handlePublish: () => Promise<void>;
  autoJoinEnabled: boolean;
  isTogglingAutoJoin: boolean;
  handleToggleAutoJoin: () => Promise<void>;
  urlCopied: boolean;
  handleCopyUrl: () => Promise<void>;
  canPublish: boolean;
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
  const [isTogglingAutoJoin, setIsTogglingAutoJoin] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const canPublish = fsId !== undefined && fsId !== "";
  const isUpToDate = isPublished && productionFsId === fsId;

  function open() {
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setPublishError(undefined);
  }

  // Fetch current production state and settings when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Reset state before fetching to avoid stale values across apps/opens
    setIsPublished(false);
    setProductionFsId(undefined);
    setPublishedUrl(undefined);
    setUrlCopied(false);
    setPublishError(undefined);

    // Check if app has a production version
    vibeDiyApi
      .getAppByFsId({ appSlug, userSlug })
      .then((res) => {
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
        if (res.isOk()) {
          setAutoJoinEnabled(res.Ok().settings.entry.enableRequest?.autoAcceptViewRequest === true);
        }
      })
      .catch(() => {
        // New app with no settings yet — defaults apply
      });
  }, [isOpen, appSlug, userSlug, vibeDiyApi]);

  const handlePublish = useCallback(async () => {
    if (!canPublish) return;
    setIsPublishing(true);
    setPublishError(undefined);

    try {
      // Promote current fsId to production
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

      // Ensure requests are enabled, preserving current auto-join setting
      await vibeDiyApi.ensureAppSettings({
        appSlug,
        userSlug,
        request: { enable: true, autoAcceptViewRequest: autoJoinEnabled },
      });

      const url = `${window.location.origin}/vibe/${userSlug}/${appSlug}/`;
      setPublishedUrl(url);
      setProductionFsId(fsId);
      setIsPublished(true);
    } catch {
      setPublishError("Failed to publish. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  }, [canPublish, fsId, appSlug, userSlug, vibeDiyApi, autoJoinEnabled]);

  const handleToggleAutoJoin = useCallback(async () => {
    setIsTogglingAutoJoin(true);
    const nextValue = !autoJoinEnabled;
    try {
      const result = await vibeDiyApi.ensureAppSettings({
        appSlug,
        userSlug,
        request: { enable: true, autoAcceptViewRequest: nextValue },
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
      setTimeout(() => setUrlCopied(false), 2000);
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
  };
}
