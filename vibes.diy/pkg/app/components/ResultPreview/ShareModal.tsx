import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui/button.js";
import { PendingRequestsCard } from "../mine/sharing-tab/PendingRequestsCard.js";
import { MembersSection } from "./MembersSection.js";
import { CommentsSection } from "./CommentsSection.js";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import { COMMENTS_DB_NAME } from "@vibes.diy/api-types";
import type { UseShareModalReturn } from "./useShareModal.js";

const inlineSelect =
  "rounded-[5px] border-2 border-black bg-white dark:bg-gray-800 text-sm font-medium px-1.5 py-0.5 shadow-[2px_2px_0px_0px_black] focus:outline-none disabled:opacity-50 disabled:pointer-events-none";

type Role = "editor" | "viewer";

function AutoApproveControl({
  enabled,
  role,
  onChange,
  disabled,
}: {
  enabled: boolean;
  role: Role;
  onChange: (enabled: boolean, role: Role) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 flex-wrap">
      <input
        type="checkbox"
        checked={enabled}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked, role)}
        className="rounded border-gray-300 dark:border-gray-600 disabled:opacity-50"
      />
      <span>Automatically approve new visitors</span>
      {enabled && (
        <>
          <span>as</span>
          <select
            value={role}
            disabled={disabled}
            onChange={(e) => onChange(true, e.target.value as Role)}
            className={inlineSelect}
          >
            <option value="viewer">readers</option>
            <option value="editor">editors</option>
          </select>
        </>
      )}
    </label>
  );
}

function PublishForm({ modal, publishDisabled }: { modal: UseShareModalReturn; publishDisabled: boolean }) {
  const [autoAccept, setAutoAccept] = useState(true);
  const [role, setRole] = useState<Role>("viewer");
  return (
    <div className="space-y-3">
      <AutoApproveControl
        enabled={autoAccept}
        role={role}
        onChange={(nextEnabled, nextRole) => {
          setAutoAccept(nextEnabled);
          setRole(nextRole);
        }}
        disabled={publishDisabled}
      />
      <Button
        variant="blue"
        size="fixed"
        className="w-full"
        disabled={publishDisabled}
        onClick={() => void modal.handlePublish(autoAccept, role)}
      >
        {modal.isPublishing ? "Publishing..." : "Publish"}
      </Button>
      {modal.publishError ? <p className="text-xs text-red-600 dark:text-red-400">{modal.publishError}</p> : null}
      {!modal.canPublish ? (
        <p className="text-xs text-gray-500 dark:text-gray-500">Generate some code first to publish.</p>
      ) : null}
    </div>
  );
}

function PublishedAutoApproveControl({ modal }: { modal: UseShareModalReturn }) {
  // When auto-approve is off there's no stored role — remember the last chosen
  // role locally so toggling back on restores it.
  const [role, setRole] = useState<Role>(modal.autoAcceptRole ?? "viewer");
  useEffect(() => {
    if (modal.autoAcceptRole) setRole(modal.autoAcceptRole);
  }, [modal.autoAcceptRole]);

  return (
    <AutoApproveControl
      enabled={modal.autoJoinEnabled}
      role={role}
      onChange={(nextEnabled, nextRole) => {
        setRole(nextRole);
        void modal.handleSetAutoAccept(nextEnabled, nextRole);
      }}
      disabled={modal.isTogglingAutoJoin}
    />
  );
}

// Read-only hook returning whether the comments dbAcl is pinned to "editors-only".
// Returns null while the initial fetch is in flight or the modal is closed.
function useCommentsEditorsOnly(userSlug: string, appSlug: string, isOpen: boolean): boolean | null {
  const { vibeDiyApi } = useVibesDiy();
  const [editorsOnly, setEditorsOnly] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void vibeDiyApi.ensureAppSettings({ userSlug, appSlug }).then((res) => {
      if (cancelled || res.isErr()) return;
      const stored = res.Ok().settings.entry.dbAcls?.[COMMENTS_DB_NAME];
      setEditorsOnly(stored?.write?.length === 1 && stored.write[0] === "editors");
    });
    return () => {
      cancelled = true;
    };
  }, [vibeDiyApi, userSlug, appSlug, isOpen]);
  return editorsOnly;
}

// Owner-only toggle that flips the comments dbAcl between the lazy default
// (members write/delete) and editors-only via the regular ensureAppSettings
// flow. Toggling off removes the entry, falling back to the resolver default.
function CommentsPolicyToggle({ userSlug, appSlug, isOpen }: { userSlug: string; appSlug: string; isOpen: boolean }) {
  const { vibeDiyApi } = useVibesDiy();
  const editorsOnlyInitial = useCommentsEditorsOnly(userSlug, appSlug, isOpen);
  const [editorsOnly, setEditorsOnly] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editorsOnlyInitial !== null) setEditorsOnly(editorsOnlyInitial);
  }, [editorsOnlyInitial]);

  async function toggle() {
    if (editorsOnly === null || busy) return;
    setBusy(true);
    const next = !editorsOnly;
    const res = await vibeDiyApi.ensureAppSettings(
      next
        ? {
            userSlug,
            appSlug,
            dbAcl: { dbName: COMMENTS_DB_NAME, acl: { write: ["editors"], delete: ["editors"] } },
          }
        : { userSlug, appSlug, dbAclRemove: { dbName: COMMENTS_DB_NAME } }
    );
    setBusy(false);
    if (res.isOk()) setEditorsOnly(next);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input
        type="checkbox"
        checked={editorsOnly === true}
        disabled={editorsOnly === null || busy}
        onChange={() => void toggle()}
        className="rounded border-gray-300 dark:border-gray-600 disabled:opacity-50"
      />
      <span>Only collaborators can comment</span>
    </label>
  );
}

interface ShareModalProps {
  modal: UseShareModalReturn;
  /** Where to position the popover relative to the trigger button. Default "below". */
  placement?: "below" | "above";
  /**
   * When true, render the owner-only "Only collaborators can comment" toggle
   * and treat the viewer as a moderator for comment deletion.
   */
  isOwner?: boolean;
  /**
   * Viewer's role on this vibe — used to disable the comments composer up
   * front when the owner has set "Only collaborators can comment". Defaults
   * to "none" so missing prop = no preemptive disable.
   */
  myGrant?: "owner" | "editor" | "viewer" | "submitter" | "public" | "none";
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isMobile;
}

export function ShareModal({ modal, placement = "below", isOwner = false, myGrant = "none" }: ShareModalProps) {
  const isMobile = useIsMobile();
  const commentsEditorsOnly = useCommentsEditorsOnly(modal.userSlug, modal.appSlug, modal.isOpen);
  // Composer is disabled when the owner has restricted commenting to editors
  // and the viewer isn't owner or editor. Server is still the authority — this
  // is a UX prefetch so non-collaborators don't see a server reject after submit.
  const composerDisabled = commentsEditorsOnly === true && myGrant !== "owner" && myGrant !== "editor";

  useEffect(() => {
    if (!modal.isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") modal.close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal.isOpen, modal]);

  if (!modal.isOpen || !modal.buttonRef.current) return null;

  const buttonRect = modal.buttonRef.current.getBoundingClientRect();
  const menuStyle: React.CSSProperties = isMobile
    ? {}
    : placement === "above"
      ? {
          position: "fixed",
          bottom: `${window.innerHeight - buttonRect.top + 8}px`,
          right: `${window.innerWidth - buttonRect.right}px`,
        }
      : {
          position: "fixed",
          top: `${buttonRect.bottom + 8}px`,
          right: `${window.innerWidth - buttonRect.right}px`,
        };

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      modal.close();
    }
  }

  const publishDisabled = modal.isPublishing || !modal.canPublish || !modal.settingsLoaded;

  const panelClassName = isMobile
    ? "fixed inset-3 flex flex-col overflow-hidden rounded-[5px] border-2 border-black bg-white shadow-[4px_4px_0px_0px_black] dark:bg-gray-900"
    : "w-max min-w-80 max-w-[min(42rem,calc(100vw-2rem))] rounded-[5px] border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black] dark:bg-gray-900";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] m-0 bg-black/25"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Share"
    >
      <div
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
        className={panelClassName}
      >
        {isMobile && (
          <button
            type="button"
            aria-label="Close"
            onClick={modal.close}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white text-gray-700 hover:bg-gray-100 shadow-[2px_2px_0px_0px_black] dark:bg-gray-800 dark:text-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
        {modal.isPublished && modal.publishedUrl ? (
          <>
            <div className={isMobile ? "flex-none space-y-2 p-4 pt-14" : "space-y-2"}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={modal.publishedUrl}
                  className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                />
                <Button variant="blue" size="default" onClick={() => void modal.handleCopyUrl()}>
                  {modal.urlCopied ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <title>Copied</title>
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="text-xs">Copy Link</span>
                  )}
                </Button>
              </div>
              {modal.publishError ? <p className="text-xs text-red-600 dark:text-red-400">{modal.publishError}</p> : null}
              <Button
                variant={modal.isUpToDate ? "cool" : "blue"}
                size="fixed"
                className="w-full"
                onClick={() => void modal.handlePublish(modal.autoJoinEnabled, modal.autoAcceptRole ?? "viewer")}
                disabled={modal.isPublishing || !modal.canPublish || modal.isUpToDate || !modal.settingsLoaded}
              >
                {modal.isPublishing ? "Updating..." : modal.isUpToDate ? "Up to date" : "Update"}
              </Button>
              <PublishedAutoApproveControl modal={modal} />
            </div>
            <div
              className={
                isMobile
                  ? "flex-1 min-h-0 overflow-auto border-t border-gray-200 dark:border-gray-700 p-4"
                  : ""
              }
            >
              <PendingRequestsCard userSlug={modal.userSlug} appSlug={modal.appSlug} hideHeader />
            </div>
          </>
        ) : (
          <div className={isMobile ? "p-4 pt-14" : ""}>
            <PublishForm modal={modal} publishDisabled={publishDisabled} />
          </div>
        )}
        {/* Community sections — additive, render below the publish controls
            for everyone with read access to the vibe. */}
        <div
          className={
            isMobile
              ? "flex-1 min-h-0 overflow-auto border-t border-gray-200 dark:border-gray-700 p-4 space-y-3"
              : "mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3"
          }
        >
          {isOwner ? <CommentsPolicyToggle userSlug={modal.userSlug} appSlug={modal.appSlug} isOpen={modal.isOpen} /> : null}
          <MembersSection userSlug={modal.userSlug} appSlug={modal.appSlug} />
          <CommentsSection
            userSlug={modal.userSlug}
            appSlug={modal.appSlug}
            canModerate={isOwner}
            composerDisabled={composerDisabled}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
