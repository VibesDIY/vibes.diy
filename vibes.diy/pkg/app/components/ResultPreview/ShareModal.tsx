import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui/button.js";
import { PendingRequestsCard } from "../mine/sharing-tab/PendingRequestsCard.js";
import type { UseShareModalReturn } from "./useShareModal.js";

const inlineSelect =
  "rounded-[5px] border-2 border-black bg-white dark:bg-gray-800 text-sm font-medium px-1.5 py-0.5 mx-0.5 shadow-[2px_2px_0px_0px_black] focus:outline-none disabled:opacity-50 disabled:pointer-events-none";

type Verb = "collaborate with" | "publish to";
type Audience = "anyone" | "members I approve";

function verbForRole(role: "editor" | "viewer" | undefined): Verb {
  return role === "viewer" ? "publish to" : "collaborate with";
}

function AccessSelects({
  verb,
  audience,
  onChangeVerb,
  onChangeAudience,
  disabled,
  prefix,
}: {
  verb: Verb;
  audience: Audience;
  onChangeVerb: (v: Verb) => void;
  onChangeAudience: (a: Audience) => void;
  disabled: boolean;
  prefix: string;
}) {
  return (
    <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
      {prefix}{" "}
      <select
        value={verb}
        onChange={(e) => onChangeVerb(e.target.value as Verb)}
        disabled={disabled}
        className={inlineSelect}
      >
        <option value="collaborate with">collaborate with</option>
        <option value="publish to">publish to</option>
      </select>{" "}
      <select
        value={audience}
        onChange={(e) => onChangeAudience(e.target.value as Audience)}
        disabled={disabled}
        className={inlineSelect}
      >
        <option value="anyone">anyone</option>
        <option value="members I approve">members I approve</option>
      </select>
      .
    </p>
  );
}

function PublishForm({ modal, publishDisabled }: { modal: UseShareModalReturn; publishDisabled: boolean }) {
  const [verb, setVerb] = useState<Verb>("collaborate with");
  const [audience, setAudience] = useState<Audience>("anyone");
  const autoAccept = audience === "anyone";
  const role: "editor" | "viewer" = verb === "collaborate with" ? "editor" : "viewer";
  return (
    <div className="space-y-2">
      <AccessSelects
        verb={verb}
        audience={audience}
        onChangeVerb={setVerb}
        onChangeAudience={setAudience}
        disabled={publishDisabled}
        prefix="Publish your vibe to"
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

function PublishedAccessSelects({ modal }: { modal: UseShareModalReturn }) {
  const audience: Audience = modal.autoJoinEnabled ? "anyone" : "members I approve";
  // For "members I approve" we don't have a stored role — preserve the last
  // chosen verb locally so toggling audience back to "anyone" remembers it.
  const [verb, setVerb] = useState<Verb>(verbForRole(modal.autoAcceptRole));
  // Keep verb in sync if the underlying role changes (e.g. from another UI).
  useEffect(() => {
    if (modal.autoAcceptRole) setVerb(verbForRole(modal.autoAcceptRole));
  }, [modal.autoAcceptRole]);

  function commit(nextVerb: Verb, nextAudience: Audience) {
    const role: "editor" | "viewer" = nextVerb === "collaborate with" ? "editor" : "viewer";
    void modal.handleSetAutoAccept(nextAudience === "anyone", role);
  }

  return (
    <AccessSelects
      verb={verb}
      audience={audience}
      onChangeVerb={(v) => {
        setVerb(v);
        commit(v, audience);
      }}
      onChangeAudience={(a) => commit(verb, a)}
      disabled={modal.isTogglingAutoJoin}
      prefix="I want to"
    />
  );
}

interface ShareModalProps {
  modal: UseShareModalReturn;
  /** Where to position the popover relative to the trigger button. Default "below". */
  placement?: "below" | "above";
}

export function ShareModal({ modal, placement = "below" }: ShareModalProps) {
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
  const menuStyle: React.CSSProperties =
    placement === "above"
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
        className="w-max min-w-80 max-w-[min(42rem,calc(100vw-2rem))] rounded-[5px] border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black] dark:bg-gray-900"
      >
        {modal.isPublished && modal.publishedUrl ? (
          <div className="space-y-2">
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
            <PublishedAccessSelects modal={modal} />
            <PendingRequestsCard userSlug={modal.userSlug} appSlug={modal.appSlug} hideHeader />
          </div>
        ) : (
          <PublishForm modal={modal} publishDisabled={publishDisabled} />
        )}
      </div>
    </div>,
    document.body
  );
}
