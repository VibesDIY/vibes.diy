import { useState, useRef, useEffect, useCallback, createElement } from "react";
import { toast } from "react-hot-toast";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";
import { buildEmbedSnippet } from "../../lib/iframe-policy.js";
import { buildPinterestShareUrl, vibeScreenshotImageUrl } from "../../utils/vibeUrls.js";

interface UseShareModalParams {
  ownerHandle: string;
  appSlug: string;
  fsId: string | undefined;
  chatApi: VibesDiyApiIface;
  sharedApi: VibesDiyApiIface;
  /**
   * Runtime host base (`VIBES_SVC_HOSTNAME_BASE`). Used to build the public
   * preview-image URL for social shares (Pinterest). May carry a leading dot.
   */
  hostnameBase: string;
}

interface UseShareModalReturn {
  ownerHandle: string;
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
  /**
   * True only when the vibe is anonymously viewable — published (production)
   * AND public access enabled. Deliberately stricter than the world-readable
   * hint: auto-accept request apps are NOT anonymously embeddable.
   */
  isPubliclyEmbeddable: boolean;
  /** Copy-ready `<iframe>` markup for the /embed/ route, or undefined when not embeddable. */
  embedSnippet: string | undefined;
  embedCopied: boolean;
  handleCopyEmbed: () => Promise<void>;
  /**
   * Pinterest pin-create URL for sharing the vibe to a board, or undefined when
   * the vibe isn't published. Gated for display by `isPubliclyEmbeddable` (the
   * pin image must be publicly fetchable), mirroring the embed snippet.
   */
  pinterestShareUrl: string | undefined;
}

export type { UseShareModalReturn };

export function useShareModal({
  ownerHandle,
  appSlug,
  fsId,
  chatApi,
  sharedApi,
  hostnameBase,
}: UseShareModalParams): UseShareModalReturn {
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
  const [publicAccessEnabled, setPublicAccessEnabled] = useState(false);
  const [embedSnippet, setEmbedSnippet] = useState<string | undefined>(undefined);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [pinterestShareUrl, setPinterestShareUrl] = useState<string | undefined>(undefined);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const embedCopyTimeoutRef = useRef<number | null>(null);

  const canPublish = fsId !== undefined && fsId !== "";
  const isUpToDate = isPublished && productionFsId === fsId;
  // Only flag as "unpublished changes" when there's a known local fsId to
  // compare. Without that gate the badge would erroneously fire on /vibe/
  // pages that lack an fsId URL param (productionFsId !== undefined would be
  // trivially true).
  const hasUnpublishedChanges =
    isPublished && fsId !== undefined && fsId !== "" && productionFsId !== undefined && productionFsId !== fsId;
  // Anonymously embeddable iff published AND public access is on. Stricter than
  // the world-readable hint (which also covers auto-accept request apps).
  const isPubliclyEmbeddable = isPublished && publicAccessEnabled;

  // Proactively fetch the production fsId once per (appSlug, ownerHandle) so the
  // Share button can show an "unpublished changes" badge before the modal is
  // ever opened. We intentionally do NOT depend on `fsId` here — a fresh save
  // changes fsId on every keystroke and would otherwise re-trigger this fetch.
  // The production fsId only changes when the user publishes (handled in
  // handlePublish via setProductionFsId) or when the modal is reopened.
  useEffect(() => {
    let cancelled = false;
    // This hook persists across (ownerHandle, appSlug) changes when the user
    // navigates between vibes on the /chat/* and /vibe/* routes. Since we no
    // longer clear publishedUrl on modal-open, clear the eager published state
    // here whenever the params change so a fast Share-open can't surface or copy
    // the previous vibe's URL before this fetch resolves for the new vibe.
    setIsPublished(false);
    setProductionFsId(undefined);
    setPublishedUrl(undefined);
    sharedApi
      .getAppByFsId({ appSlug, ownerHandle })
      .then((res) => {
        if (cancelled) return;
        if (res.isOk()) {
          const app = res.Ok();
          if (app.mode === "production" && app.fsId) {
            setIsPublished(true);
            setProductionFsId(app.fsId);
            // Resolve the share URL eagerly (it's deterministic from owner/slug)
            // so the published view is ready the instant the modal opens, rather
            // than rendering the publish form first and swapping once the
            // modal-open fetch resolves (the #2236 compact→full flash).
            setPublishedUrl(`${window.location.origin}/vibe/${ownerHandle}/${appSlug}`);
          } else {
            setIsPublished(false);
            setProductionFsId(undefined);
            setPublishedUrl(undefined);
          }
        }
      })
      .catch(() => {
        // App may not exist yet — defaults apply (badge stays hidden)
      });
    return () => {
      cancelled = true;
    };
  }, [appSlug, ownerHandle, sharedApi]);

  function clearCopyTimeout() {
    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
  }

  function clearEmbedCopyTimeout() {
    if (embedCopyTimeoutRef.current !== null) {
      window.clearTimeout(embedCopyTimeoutRef.current);
      embedCopyTimeoutRef.current = null;
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
    // reset isPublished / productionFsId / publishedUrl here — those are sourced
    // by both the proactive mount-effect (drives the badge + eager URL) and this
    // modal-open effect. Resetting them would flash the badge off → on and swap
    // the published view for the publish form on each open (the #2236 flash).
    setUrlCopied(false);
    setPublishError(undefined);
    setAutoJoinEnabled(false);
    setAutoAcceptRoleState(undefined);
    setSettingsLoaded(false);
    setPublicAccessEnabled(false);
    setEmbedSnippet(undefined);
    setEmbedCopied(false);
    setPinterestShareUrl(undefined);
    clearCopyTimeout();
    clearEmbedCopyTimeout();

    // Check if app has a production version. Always normalize state from the
    // fetch result (both branches) so a transition from "was published" to
    // "no longer published" doesn't leave the badge state stale.
    sharedApi
      .getAppByFsId({ appSlug, ownerHandle })
      .then((res) => {
        if (cancelled) return;
        if (res.isOk()) {
          const app = res.Ok();
          if (app.mode === "production" && app.fsId) {
            setIsPublished(true);
            setProductionFsId(app.fsId);
            const vibeUrl = `${window.location.origin}/vibe/${ownerHandle}/${appSlug}`;
            setPublishedUrl(vibeUrl);
            setEmbedSnippet(
              buildEmbedSnippet({
                embedUrl: `${window.location.origin}/embed/${ownerHandle}/${appSlug}`,
                title: `${appSlug} — made on vibes.diy`,
              })
            );
            setPinterestShareUrl(
              buildPinterestShareUrl({
                pageUrl: vibeUrl,
                imageUrl: vibeScreenshotImageUrl({ ownerHandle, appSlug, hostnameBase }),
                description: `${appSlug} — made on vibes.diy`,
              })
            );
          } else {
            setIsPublished(false);
            setProductionFsId(undefined);
            setPublishedUrl(undefined);
            setEmbedSnippet(undefined);
            setPinterestShareUrl(undefined);
          }
        }
      })
      .catch(() => {
        // App may not exist yet — defaults apply
      });

    // Fetch sharing settings
    sharedApi
      .ensureAppSettings({ appSlug, ownerHandle })
      .then((res) => {
        if (cancelled) return;
        if (res.isOk()) {
          const entry = res.Ok().settings.entry;
          const role = entry.enableRequest?.autoAcceptRole;
          const validRole = role === "editor" || role === "viewer" ? role : undefined;
          setAutoJoinEnabled(!!validRole);
          setAutoAcceptRoleState(validRole);
          setPublicAccessEnabled(entry.publicAccess?.enable === true);
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
  }, [isOpen, appSlug, ownerHandle, sharedApi, hostnameBase]);

  const handlePublish = useCallback(
    async (autoJoin: boolean, role: "editor" | "viewer" = "editor") => {
      if (!canPublish || !settingsLoaded) return;
      const isInitialPublish = !isPublished;
      setIsPublishing(true);
      setPublishError(undefined);

      try {
        const modeResult = await chatApi.setSetModeFs({
          fsId: fsId as string,
          appSlug,
          ownerHandle,
          mode: "production",
        });

        if (!modeResult.isOk()) {
          setPublishError("Failed to publish. Please try again.");
          return;
        }

        const settingsResult = await sharedApi.ensureAppSettings({
          appSlug,
          ownerHandle,
          request: { enable: true, autoAcceptRole: autoJoin ? role : undefined },
        });

        if (!settingsResult.isOk()) {
          setPublishError("Published, but failed to update sharing settings.");
        } else {
          setAutoJoinEnabled(autoJoin);
          setAutoAcceptRoleState(autoJoin ? role : undefined);
        }

        const url = `${window.location.origin}/vibe/${ownerHandle}/${appSlug}`;
        setPublishedUrl(url);
        setProductionFsId(fsId);
        setIsPublished(true);

        // On the first publish, don't hijack the user into a new tab (#2234).
        // Their mental model is "Publish makes the link" — so copy it to the
        // clipboard and surface an inline toast with a "View live" link, letting
        // them choose when to switch context.
        if (isInitialPublish) {
          let copied = false;
          try {
            await navigator.clipboard.writeText(url);
            copied = true;
            setUrlCopied(true);
            clearCopyTimeout();
            copyTimeoutRef.current = window.setTimeout(() => setUrlCopied(false), 2000);
          } catch {
            // Clipboard can reject (permissions/focus); the link is still shown
            // in the panel's Copy Link row, so this is non-fatal. Don't claim it
            // was copied in that case.
          }
          toast.success(
            createElement(
              "span",
              null,
              copied ? "Published — link copied. " : "Published — use Copy Link to copy. ",
              createElement(
                "a",
                { href: url, target: "_blank", rel: "noreferrer", className: "font-medium underline" },
                "View live →"
              )
            ),
            { duration: 6000 }
          );
        }
      } catch {
        setPublishError("Failed to publish. Please try again.");
      } finally {
        setIsPublishing(false);
      }
    },
    [canPublish, settingsLoaded, isPublished, fsId, appSlug, ownerHandle, chatApi, sharedApi]
  );

  const handleToggleAutoJoin = useCallback(async () => {
    setIsTogglingAutoJoin(true);
    const nextValue = !autoJoinEnabled;
    try {
      const result = await sharedApi.ensureAppSettings({
        appSlug,
        ownerHandle,
        request: { enable: true, autoAcceptRole: nextValue ? "editor" : undefined },
      });
      if (result.isOk()) {
        setAutoJoinEnabled(nextValue);
        setAutoAcceptRoleState(nextValue ? "editor" : undefined);
      }
    } finally {
      setIsTogglingAutoJoin(false);
    }
  }, [autoJoinEnabled, appSlug, ownerHandle, sharedApi]);

  const handleSetAutoAccept = useCallback(
    async (autoAccept: boolean, role: "editor" | "viewer") => {
      setIsTogglingAutoJoin(true);
      try {
        const result = await sharedApi.ensureAppSettings({
          appSlug,
          ownerHandle,
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
    [appSlug, ownerHandle, sharedApi]
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

  const handleCopyEmbed = useCallback(async () => {
    if (!embedSnippet) return;
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setEmbedCopied(true);
      clearEmbedCopyTimeout();
      embedCopyTimeoutRef.current = window.setTimeout(() => setEmbedCopied(false), 2000);
    } catch {
      setPublishError("Could not copy embed code.");
    }
  }, [embedSnippet]);

  return {
    ownerHandle,
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
    isPubliclyEmbeddable,
    embedSnippet,
    embedCopied,
    handleCopyEmbed,
    pinterestShareUrl,
  };
}
