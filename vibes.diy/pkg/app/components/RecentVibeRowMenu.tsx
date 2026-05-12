import React, { useEffect, useRef } from "react";

interface RecentVibeRowMenuProps {
  isPinned: boolean;
  open: boolean;
  onClose: () => void;
  onPinToggle: () => void;
  onRenameStart: () => void;
}

// Inline (non-portal) dropdown for a single sidebar row. Lives inside the
// row's <li>, so the SessionSidebar's outside-click handler keeps the
// sidebar open as long as the click stays inside it. The menu's own
// outside-click closes only itself.
export function RecentVibeRowMenu({ isPinned, open, onClose, onPinToggle, onRenameStart }: RecentVibeRowMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDocMouseDown(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    // Focus the first menuitem when the menu opens
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
  }, [open]);

  if (!open) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const idx = items.findIndex((el) => el === document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = items[idx + 1] ?? items[0];
      next?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = items[idx - 1] ?? items[items.length - 1];
      prev?.focus();
    }
  }

  const itemBase =
    "block w-full px-3 py-3 text-left text-sm sm:py-2 pointer-coarse:py-3.5 touch-manipulation";

  return (
    <div
      ref={menuRef}
      role="menu"
      onKeyDown={handleKeyDown}
      className="absolute right-1 top-9 z-20 w-44 overflow-hidden rounded-md border border-black/10 bg-light-background-00 shadow-lg dark:border-white/10 dark:bg-dark-background-00 sm:top-8 sm:w-36"
    >
      <button
        type="button"
        role="menuitem"
        className={`${itemBase} hover:bg-black/5 dark:hover:bg-white/5`}
        onClick={() => {
          onPinToggle();
          onClose();
        }}
      >
        {isPinned ? "Unpin" : "Pin"}
      </button>
      <button
        type="button"
        role="menuitem"
        className={`${itemBase} hover:bg-black/5 dark:hover:bg-white/5`}
        onClick={() => {
          onRenameStart();
          onClose();
        }}
      >
        Rename
      </button>
    </div>
  );
}
