import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { ChatMessageDocument } from "@vibes.diy/prompts";
import { publishApp } from "../../utils/publishUtils.js";

export interface UseShareModalParams {
  sessionId: string | undefined;
  code: string;
  title: string | undefined;
  messages: ChatMessageDocument[];
  publishedUrl?: string;
  updatePublishedUrl: (url: string) => Promise<void>;
}

export interface UseShareModalResult {
  // Modal state
  isOpen: boolean;
  open: () => void;
  close: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;

  // Publish
  canPublish: boolean;
  isPublished: boolean;
  isPublishing: boolean;
  publishError: string | undefined;
  publishedUrl: string | undefined;
  handlePublish: () => Promise<void>;

  // Auto-join (UI state only; persisted locally)
  autoJoinEnabled: boolean;
  isTogglingAutoJoin: boolean;
  handleToggleAutoJoin: () => Promise<void>;

  // Clipboard
  urlCopied: boolean;
  handleCopyUrl: () => Promise<void>;
}

function tryGetPublishedSlug(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const [subdomain] = parsed.hostname.split(".");
    return subdomain || undefined;
  } catch {
    return undefined;
  }
}

function toCleanShareUrl(slug: string): string {
  const origin =
    typeof window === "undefined"
      ? "https://vibes.diy"
      : window.location.origin;
  return new URL(`/vibe/${slug}/`, origin).href;
}

function getLocalStorageKey(sessionId: string | undefined): string {
  return `vibes-share:auto-join:${sessionId ?? "unknown"}`;
}

export function useShareModal({
  sessionId,
  code,
  title,
  messages,
  updatePublishedUrl,
  publishedUrl: initialPublishedUrl,
}: UseShareModalParams): UseShareModalResult {
  const { getToken, userId } = useAuth();

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | undefined>(
    undefined,
  );
  const [publishedUrl, setPublishedUrl] = useState<string | undefined>(
    initialPublishedUrl,
  );

  const [autoJoinEnabled, setAutoJoinEnabled] = useState(false);
  const [isTogglingAutoJoin, setIsTogglingAutoJoin] = useState(false);

  const [urlCopied, setUrlCopied] = useState(false);
  const resetCopyTimerRef = useRef<number | undefined>(undefined);

  const canPublish = sessionId !== undefined;

  // Keep local state in sync with any upstream changes.
  useEffect(() => {
    if (initialPublishedUrl) {
      setPublishedUrl(initialPublishedUrl);
    }
  }, [initialPublishedUrl]);

  // Initialize auto-join state whenever the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(getLocalStorageKey(sessionId));
    setAutoJoinEnabled(raw === "true");
  }, [isOpen, sessionId]);

  useEffect(() => {
    return () => {
      if (resetCopyTimerRef.current !== undefined) {
        window.clearTimeout(resetCopyTimerRef.current);
      }
    };
  }, []);

  const isPublished = !!publishedUrl;

  const open = useCallback(() => {
    setUrlCopied(false);
    setPublishError(undefined);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const prompt = useMemo(() => {
    if (messages.length === 0) return undefined;
    const userMessages = messages.filter((message) => message.type === "user");
    if (
      userMessages.length >= 2 &&
      userMessages[0]?._id === "0001-user-first"
    ) {
      return userMessages[1]?.text;
    }
    return userMessages[0]?.text;
  }, [messages]);

  const handlePublish = useCallback(async () => {
    if (!sessionId) return;
    if (isPublishing) return;

    setIsPublishing(true);
    setPublishError(undefined);
    setUrlCopied(false);

    const token = await getToken();
    if (!token) {
      setPublishError("Please log in to publish.");
      setIsPublishing(false);
      return;
    }

    const appUrl = await publishApp({
      sessionId,
      code,
      title,
      prompt,
      updatePublishedUrl,
      token,
      userId: userId || undefined,
    });

    if (!appUrl) {
      setPublishError("Publish failed.");
      setIsPublishing(false);
      return;
    }

    const slug = tryGetPublishedSlug(appUrl);
    if (!slug) {
      setPublishError("Publish succeeded, but the app URL was not recognized.");
      setIsPublishing(false);
      return;
    }

    const cleanUrl = toCleanShareUrl(slug);
    setPublishedUrl(cleanUrl);

    setIsPublishing(false);
  }, [
    sessionId,
    isPublishing,
    getToken,
    code,
    title,
    prompt,
    updatePublishedUrl,
    userId,
  ]);

  const handleToggleAutoJoin = useCallback(async () => {
    if (isTogglingAutoJoin) return;

    setIsTogglingAutoJoin(true);
    const next = !autoJoinEnabled;
    setAutoJoinEnabled(next);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(getLocalStorageKey(sessionId), String(next));
    }

    setIsTogglingAutoJoin(false);
  }, [autoJoinEnabled, isTogglingAutoJoin, sessionId]);

  const handleCopyUrl = useCallback(async () => {
    if (!publishedUrl) return;
    if (typeof navigator === "undefined") return;

    await navigator.clipboard.writeText(publishedUrl);
    setUrlCopied(true);

    if (resetCopyTimerRef.current !== undefined) {
      window.clearTimeout(resetCopyTimerRef.current);
    }

    resetCopyTimerRef.current = window.setTimeout(() => {
      setUrlCopied(false);
    }, 2000);
  }, [publishedUrl]);

  return {
    isOpen,
    open,
    close,
    buttonRef,
    canPublish,
    isPublished,
    isPublishing,
    publishError,
    publishedUrl,
    handlePublish,
    autoJoinEnabled,
    isTogglingAutoJoin,
    handleToggleAutoJoin,
    urlCopied,
    handleCopyUrl,
  };
}
