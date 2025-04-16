import { createPortal } from 'react-dom';

interface UserMenuProps {
  isOpen: boolean;
  onLogout: () => void;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

export function UserMenu({ isOpen, onLogout, onClose, buttonRef }: UserMenuProps) {
  if (!isOpen || !buttonRef.current) return null;

  // Get the button's position to position the menu relative to it
  const buttonRect = buttonRef.current.getBoundingClientRect();

  const menuStyle = {
    position: 'fixed' as const,
    top: `${buttonRect.bottom + 8}px`, // 8px gap
    right: `${window.innerWidth - buttonRect.right}px`,
  };

  const handleBackdropClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <dialog
      open
      className="fixed inset-0 z-[9999] m-0 bg-transparent p-0"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
      aria-label="User menu"
    >
      <div
        style={menuStyle}
        className="ring-opacity-5 w-48 rounded bg-white p-4 shadow-lg ring-1 ring-black dark:bg-dark-background-01"
      >
        <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="user-menu">
          <button
            type="button"
            onClick={onLogout}
            className="block w-full rounded accent-00 px-4 py-2 text-center text-sm text-light-secondary hover:bg-light-background-01 dark:bg-dark-decorative-01 dark:text-dark-secondary dark:hover:bg-dark-decorative-00"
            role="menuitem"
          >
            <span className="w-full text-center font-bold">Logout</span>
          </button>
        </div>
      </div>
    </dialog>,
    document.body
  );
}
