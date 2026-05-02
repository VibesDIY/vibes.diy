import { useState, useRef, useEffect, useCallback } from "react";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";

interface UseShareModalParams {
  userSlug: string;
  appSlug: string;
  fsId: string | undefined;
  vibeDiyApi: VibesDiyApiIface;
}

interface UseShareModalReturn {
  userSlug: string;
  appSlug: string;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  isPublished: boolean;
  isPublishing: boolean;
  isUpToDate: boolean;
  /** True when the app has a published version and the current fsId differs from it. */
  hasUnpublishedChanges: boolean;
  publishError: string | undefined;
  publishedUrl: string | undefined;
  handlePublish: (autoJoin: boolean, role?: "editor" | "viewer") => Promise<void>;
  autoJoinEnabled: boolean;
  /** Current auto-approve role, or undefined when auto-approve is off. */
  autoAcceptRole: "editor" | "viewer" | undefined;
  isTogglingAutoJoin: boolean;
  handleToggleAutoJoin: () => Promise<void>;
  /** Set both auto-approve on/off and the role granted when auto-approved. */
  handleSetAutoAccept: (autoAccept: boolean, role: "editor" | "viewer") => Promise<void>;
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
  const [autoAcceptRole, setAutoAcceptRoleState] = useState<"editor" | "viewer" | undefined>(undefined);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isTogglingAutoJoin, setIsTogglingAutoJoin] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const canPublish = fsId !== undefined && fsId !== "";
  const isUpToDate = isPublished && productionFsId === fsId;
  // Only flag as "unpublished changes" when there's a known local fsId to
  // compare. Without that gate the badge would erroneously fire on /vibe/
  // pages that lack an fsId URL param (productionFsId !== undefined would be
  // trivially true).
  const hasUnpublishedChanges =
    isPublished && fsId !== undefined && fsId !== "" && productionFsId !== undefined && productionFsId !== fsId;

  // Proactively fetch the production fsId once per (appSlug, userSlug) so the
  // Share button can show an "unpublished changes" badge before the modal is
  // ever opened. We intentionally do NOT depend on `fsId` here — a fresh save
  // changes fsId on every keystroke and would otherwise re-trigger this fetch.
  // The production fsId only changes when the user publishes (handled in
  // handlePublish via setProductionFsId) or when the modal is reopened.
  useEffect(() => {
    let cancelled = false;
    vibeDiyApi
      .getAppByFsId({ appSlug, userSlug })
      .then((res) => {
        if (cancelled) return;
        if (res.isOk()) {
          const app = res.Ok();
          if (app.mode === "production" && app.fsId) {
            setIsPublished(true);
            setProductionFsId(app.fsId);
          } else {
            setIsPublished(false);
            setProductionFsId(undefined);
          }
        }
      })
      .catch(() => {
        // App may not exist yet — defaults apply (badge stays hidden)
      });
    return () => {
      cancelled = true;
    };
  }, [appSlug, userSlug, vibeDiyApi]);

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

    // Reset transient UI state before re-fetching. We intentionally do NOT
    // reset isPublished / productionFsId here — those are sourced by both the
    // proactive mount-effect (drives the badge) and this modal-open effect.
    // Resetting them would cause the badge to flash off → on each open.
    setPublishedUrl(undefined);
    setUrlCopied(false);
    setPublishError(undefined);
    setAutoJoinEnabled(false);
    setAutoAcceptRoleState(undefined);
    setSettingsLoaded(false);
    clearCopyTimeout();

    // Check if app has a production version. Always normalize state from the
    // fetch result (both branches) so a transition from "was published" to
    // "no longer published" doesn't leave the badge state stale.
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
          } else {
            setIsPublished(false);
            setProductionFsId(undefined);
            setPublishedUrl(undefined);
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
          const role = res.Ok().settings.entry.enableRequest?.autoAcceptRole;
          const validRole = role === "editor" || role === "viewer" ? role : undefined;
          setAutoJoinEnabled(!!validRole);
          setAutoAcceptRoleState(validRole);
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
    async (autoJoin: boolean, role: "editor" | "viewer" = "viewer") => {
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
          request: { enable: true, autoAcceptRole: autoJoin ? role : undefined },
        });

        if (!settingsResult.isOk()) {
          setPublishError("Published, but failed to update sharing settings.");
        } else {
          setAutoJoinEnabled(autoJoin);
          setAutoAcceptRoleState(autoJoin ? role : undefined);
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
        setAutoAcceptRoleState(nextValue ? "viewer" : undefined);
      }
    } finally {
      setIsTogglingAutoJoin(false);
    }
  }, [autoJoinEnabled, appSlug, userSlug, vibeDiyApi]);

  const handleSetAutoAccept = useCallback(
    async (autoAccept: boolean, role: "editor" | "viewer") => {
      setIsTogglingAutoJoin(true);
      try {
        const result = await vibeDiyApi.ensureAppSettings({
          appSlug,
          userSlug,
          request: { enable: true, autoAcceptRole: autoAccept ? role : undefined },
        });
        if (result.isOk()) {
          setAutoJoinEnabled(autoAccept);
          setAutoAcceptRoleState(autoAccept ? role : undefined);
        }
      } finally {
        setIsTogglingAutoJoin(false);
      }
    },
    [appSlug, userSlug, vibeDiyApi]
  );

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
    userSlug,
    appSlug,
    isOpen,
    open,
    close,
    buttonRef,
    isPublished,
    isPublishing,
    isUpToDate,
    hasUnpublishedChanges,
    publishError,
    publishedUrl,
    handlePublish,
    autoJoinEnabled,
    autoAcceptRole,
    isTogglingAutoJoin,
    handleToggleAutoJoin,
    handleSetAutoAccept,
    urlCopied,
    handleCopyUrl,
    canPublish,
    settingsLoaded,
  };
}
