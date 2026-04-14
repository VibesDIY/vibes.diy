import React, { useState, useRef, useEffect } from "react";
import { ShareModal } from "../app/components/ResultPreview/ShareModal.js";
import type { UseShareModalResult } from "../app/components/ResultPreview/useShareModal.js";

interface MockShareModalProps {
  // Modal state
  isOpen?: boolean;

  // Publishing state
  isPublishing?: boolean;
  publishedUrl?: string;

  // Configuration
  showCloseButton?: boolean;

  // Event handlers (for interactive demos)
  onClose?: () => void;
  onPublish?: () => Promise<void>;
}

export const MockShareModal: React.FC<MockShareModalProps> = ({
  isOpen = true,
  isPublishing = false,
  publishedUrl = "",
  showCloseButton = true,
  onClose,
  onPublish,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [internalIsOpen, setInternalIsOpen] = useState(isOpen);
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  useEffect(() => {
    setInternalIsOpen(isOpen);
  }, [isOpen]);

  const handleClose = () => {
    setInternalIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  // Create a mock button rect for centered positioning
  const mockButtonRect = {
    bottom: 200,
    right: 600,
    top: 160,
    left: 500,
    width: 100,
    height: 40,
    x: 500,
    y: 160,
  };

  // Ensure document.body exists for portal
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Mock the button ref with a fake getBoundingClientRect
    if (buttonRef.current) {
      buttonRef.current.getBoundingClientRect = () => mockButtonRect as DOMRect;
    }
  }, []);

  const props: UseShareModalResult = {
    isOpen: internalIsOpen,
    open: () => {
      setInternalIsOpen(true);
    },
    close: handleClose,
    buttonRef,
    canPublish: true,
    isPublished: publishedUrl.length > 0,
    isPublishing,
    publishError: undefined,
    publishedUrl: publishedUrl || undefined,
    handlePublish: async () => {
      await onPublish?.();
    },
    autoJoinEnabled,
    isTogglingAutoJoin: false,
    handleToggleAutoJoin: async () => {
      setAutoJoinEnabled((prev) => !prev);
    },
    urlCopied,
    handleCopyUrl: async () => {
      setUrlCopied(true);
      window.setTimeout(() => {
        setUrlCopied(false);
      }, 1500);
    },
  };

  return (
    <div className="relative flex h-96 flex-col items-center pt-8">
      {/* Visible reference button for context */}
      <div className="mb-4">
        <button
          ref={buttonRef}
          className="rounded bg-blue-500 px-3 py-1.5 text-sm text-white"
        >
          Share Button (Reference)
        </button>
      </div>

      {showCloseButton && (
        <button
          onClick={handleClose}
          className="mb-4 rounded bg-gray-200 px-3 py-1.5 text-sm hover:bg-gray-300"
        >
          Close Modal (for demo)
        </button>
      )}

      {isClient && <ShareModal {...props} />}
    </div>
  );
};
