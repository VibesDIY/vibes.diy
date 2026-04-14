import * as React from "react";
import { BuildURI, exception2Result } from "@adviser/cement";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";

import { getAppHostBaseUrl } from "../../utils/vibeUrls.js";

export type ShareModalApi = Pick<VibesDiyApiIface, "ensureAppSettings" | "setSetModeFs">;

export interface UseShareModalArgs {
  readonly userSlug: string;
  readonly appSlug: string;
  readonly fsId?: string;
  readonly vibeDiyApi: ShareModalApi;
}

export interface ShareModalState {
  readonly isOpen: boolean;
  readonly open: () => void;
  readonly close: () => void;
  readonly buttonRef: React.RefObject<HTMLButtonElement | null>;

  readonly isPublished: boolean;
  readonly isPublishing: boolean;
  readonly publishError?: string;
  readonly publishedUrl?: string;
  readonly canPublish: boolean;
  readonly handlePublish: () => Promise<void>;

  readonly autoJoinEnabled: boolean;
  readonly isTogglingAutoJoin: boolean;
  readonly handleToggleAutoJoin: () => Promise<void>;

  readonly urlCopied: boolean;
  readonly handleCopyUrl: () => Promise<void>;
}

function buildPublishedUrl({ userSlug, appSlug }: { userSlug: string; appSlug: string }) {
  const baseUrl = getAppHostBaseUrl();
  if (baseUrl.trim() === "") {
    return `/vibe/${userSlug}/${appSlug}/`;
  }
  return BuildURI.from(baseUrl).pathname(`/vibe/${userSlug}/${appSlug}/`).toString();
}

export function useShareModal({ userSlug, appSlug, fsId, vibeDiyApi }: UseShareModalArgs): ShareModalState {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  const [isPublishing, setIsPublishing] = React.useState(false);
  const [publishError, setPublishError] = React.useState<string | undefined>(undefined);
  const [publishedUrl, setPublishedUrl] = React.useState<string | undefined>(undefined);
  const [autoJoinEnabled, setAutoJoinEnabled] = React.useState(false);
  const [isTogglingAutoJoin, setIsTogglingAutoJoin] = React.useState(false);
  const [urlCopied, setUrlCopied] = React.useState(false);

  const canPublish = fsId !== undefined && fsId.trim() !== "";

  const open = React.useCallback(() => {
    setPublishError(undefined);
    setUrlCopied(false);
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  React.useEffect(() => {
    if (isOpen !== true) {
      return;
    }

    let cancelled = false;
    void vibeDiyApi.ensureAppSettings({ appSlug, userSlug }).then((res) => {
      if (cancelled) return;
      if (res.isErr()) {
        setPublishError(res.Err().message);
        return;
      }
      const settings = res.Ok().settings;
      const enableRequest = settings.entry.enableRequest;
      setAutoJoinEnabled(enableRequest?.autoAcceptViewRequest === true);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, vibeDiyApi, appSlug, userSlug]);

  const handlePublish = React.useCallback(async () => {
    if (canPublish !== true || fsId === undefined) {
      return;
    }

    setIsPublishing(true);
    setPublishError(undefined);
    setUrlCopied(false);

    const rPublish = await vibeDiyApi.setSetModeFs({ fsId, appSlug, userSlug, mode: "production" });
    if (rPublish.isErr()) {
      setIsPublishing(false);
      setPublishError(rPublish.Err().message);
      return;
    }

    const nextUrl = buildPublishedUrl({ userSlug, appSlug });
    setPublishedUrl(nextUrl);

    const rSettings = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      request: {
        enable: true,
        autoAcceptViewRequest: autoJoinEnabled,
      },
    });

    if (rSettings.isErr()) {
      setPublishError(rSettings.Err().message);
    } else {
      const settings = rSettings.Ok().settings;
      const enableRequest = settings.entry.enableRequest;
      setAutoJoinEnabled(enableRequest?.autoAcceptViewRequest === true);
    }

    setIsPublishing(false);
  }, [canPublish, fsId, vibeDiyApi, appSlug, userSlug, autoJoinEnabled]);

  const handleToggleAutoJoin = React.useCallback(async () => {
    setIsTogglingAutoJoin(true);
    setPublishError(undefined);

    const rSettings = await vibeDiyApi.ensureAppSettings({
      appSlug,
      userSlug,
      request: {
        enable: true,
        autoAcceptViewRequest: !autoJoinEnabled,
      },
    });

    setIsTogglingAutoJoin(false);

    if (rSettings.isErr()) {
      setPublishError(rSettings.Err().message);
      return;
    }

    const settings = rSettings.Ok().settings;
    const enableRequest = settings.entry.enableRequest;
    setAutoJoinEnabled(enableRequest?.autoAcceptViewRequest === true);
  }, [vibeDiyApi, appSlug, userSlug, autoJoinEnabled]);

  const handleCopyUrl = React.useCallback(async () => {
    if (publishedUrl === undefined) {
      return;
    }
    if (navigator.clipboard === undefined) {
      setPublishError("Clipboard not available");
      return;
    }

    const rCopy = await exception2Result(() => navigator.clipboard.writeText(publishedUrl));
    if (rCopy.isErr()) {
      setPublishError(rCopy.Err().message);
      return;
    }
    setUrlCopied(true);
  }, [publishedUrl]);

  return {
    isOpen,
    open,
    close,
    buttonRef,
    isPublished: publishedUrl !== undefined,
    isPublishing,
    publishError,
    publishedUrl,
    canPublish,
    handlePublish,
    autoJoinEnabled,
    isTogglingAutoJoin,
    handleToggleAutoJoin,
    urlCopied,
    handleCopyUrl,
  };
}
