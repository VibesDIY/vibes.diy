import React, { useRef, useState, useEffect } from 'react';
import {
  getWrapperStyle,
  getMenuStyle,
  getContentWrapperStyle,
  getContentStyle,
  getToggleButtonStyle,
  getInnerContentWrapperStyle,
} from './HiddenMenuWrapper.styles';
import { VibesSwitch } from '../VibesSwitch/VibesSwitch';

export interface HiddenMenuWrapperProps {
  children: React.ReactNode;
  menuContent: React.ReactNode;
  triggerBounce?: boolean;
}

export function HiddenMenuWrapper({
  children,
  menuContent,
  triggerBounce,
}: HiddenMenuWrapperProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuHeight, setMenuHeight] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const [isBouncing, setIsBouncing] = useState(false);

  // Inyect keyframes for bounce animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
    @keyframes bounce {
      0%   { transform: translateY(0); }
      15%  { transform: translateY(-200px); }  /* First big bounce */
      30%  { transform: translateY(0); }
      45%  { transform: translateY(-100px); }  /* Second bounce */
      60%  { transform: translateY(0); }
      72%  { transform: translateY(-50px); }   /* Third bounce */
      82%  { transform: translateY(0); }
      89%  { transform: translateY(-25px); }   /* Fourth */
      94%  { transform: translateY(0); }
      97%  { transform: translateY(-10px); }   /* Final small bounce */
      100% { transform: translateY(0); }
    }
  `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Manage bounce animation when triggerBounce changes
  useEffect(() => {
    if (triggerBounce) {
      setIsBouncing(true);
      const timeout = setTimeout(() => setIsBouncing(false), 800); // Animation duration
      return () => clearTimeout(timeout);
    }
  }, [triggerBounce]);

  // Set menu height on render
  useEffect(() => {
    if (menuRef.current) {
      setMenuHeight(menuRef.current.offsetHeight);
    }
  }, [menuContent]);

  // Escape key handling + focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }

      if (menuOpen && e.key === 'Tab' && menuContainerRef.current) {
        const focusableElements = menuContainerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (!first || !last) return;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  // Focus menu on open
  useEffect(() => {
    if (menuOpen) {
      const firstFocusable = menuRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }, [menuOpen]);

  return (
    <div style={getWrapperStyle()}>
      {/* Menu */}
      <div
        id="hidden-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Hidden menu"
        aria-hidden={!menuOpen}
        ref={menuRef}
        style={getMenuStyle()}
      >
        {menuContent}
      </div>

      {/* Content */}
      <div style={getContentWrapperStyle(menuHeight, menuOpen, isBouncing)} ref={menuContainerRef}>
        <div style={getInnerContentWrapperStyle(menuOpen)}>
          <div style={getContentStyle()}>{children}</div>
        </div>
      </div>

      {/* Button */}
      <button
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-controls="hidden-menu"
        ref={buttonRef}
        onClick={() => setMenuOpen(!menuOpen)}
        style={getToggleButtonStyle()}
      >
        <VibesSwitch size={80} />
      </button>
    </div>
  );
}
