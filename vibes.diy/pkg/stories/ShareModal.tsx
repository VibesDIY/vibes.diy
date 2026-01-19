import React, { useState, useRef, useEffect } from "react";
import { ShareModal } from "../app/components/ResultPreview/ShareModal.js";

interface MockShareModalProps {
  // Modal state
  isOpen?: boolean;

  // Publishing state
  isPublishing?: boolean;
  publishedAppUrl?: string;
  isFirehoseShared?: boolean;

  // Configuration
  showCloseButton?: boolean;

  // Event handlers (for interactive demos)
  onClose?: () => void;
  onPublish?: (shareToFirehose?: boolean) => Promise<void>;
}

export const MockShareModal: React.FC<MockShareModalProps> = ({
  isOpen = true,
  isPublishing = false,
  publishedAppUrl = "",
  isFirehoseShared = false,
  showCloseButton = true,
  onClose,
  onPublish,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Mock publish functionality
  const handlePublish = async (shareToFirehose?: boolean) => {
    if (onPublish) {
      await onPublish(shareToFirehose);
    } else {
      console.log("Mock publish called with shareToFirehose:", shareToFirehose);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      console.log("Mock close called");
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

  return (
    <div className="relative flex h-96 flex-col items-center pt-8">
      {/* Visible reference button for context */}
      <div className="mb-4">
        <button ref={buttonRef} className="rounded bg-blue-500 px-3 py-1.5 text-sm text-white">
          Share Button (Reference)
        </button>
      </div>

      {showCloseButton && (
        <button onClick={handleClose} className="mb-4 rounded bg-gray-200 px-3 py-1.5 text-sm hover:bg-gray-300">
          Close Modal (for demo)
        </button>
      )}

      {isClient && (
        <ShareModal
          isOpen={isOpen}
          onClose={handleClose}
          buttonRef={buttonRef}
          publishedAppUrl={publishedAppUrl}
          onPublish={handlePublish}
          isPublishing={isPublishing}
          isFirehoseShared={isFirehoseShared}
        />
      )}
    </div>
  );
};
