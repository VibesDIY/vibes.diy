import React, { useRef, useState, useEffect } from 'react';
import {
  getWrapperStyle,
  getMenuStyle,
  getContentWrapperStyle,
  getContentStyle,
  getToggleButtonStyle,
  getInnerContentWrapperStyle,
} from './HiddenMenuWrapper.styles.js';
import { VibesSwitch } from '../VibesSwitch/VibesSwitch.js';

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
  const [hasBouncedOnMount, setHasBouncedOnMount] = useState(false);

  // Trigger bounce animation on first mount (respects reduced motion and menu state)
  useEffect(() => {
    if (!hasBouncedOnMount && !menuOpen) {
      // Check for reduced motion preference (with fallback for test environments)
      const prefersReducedMotion =
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
      if (!prefersReducedMotion) {
        setIsBouncing(true);
        setTimeout(() => setIsBouncing(false), 800);
      }
      setHasBouncedOnMount(true);
    }
  }, [hasBouncedOnMount, menuOpen]);

  // Inject keyframes for bounce animation
  useEffect(() => {
    const styleId = 'vibes-drop-to-close-keyframes';
    const existingStyle = document.getElementById(styleId);

    if (!existingStyle) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes vibes-drop-to-close {
          0%   { transform: translateY(-400px); }  /* Start pushed up */
          10%  { transform: translateY(0); }       /* First big drop */
          25%  { transform: translateY(-175px); }   /* First bounce back up */
          35%  { transform: translateY(0); }       /* Second drop */
          48%  { transform: translateY(-75px); }   /* Second bounce back up */
          62%  { transform: translateY(0); }       /* Third drop */
          72%  { transform: translateY(-25px); }   /* Third bounce back up */
          80%  { transform: translateY(0); }       /* Fourth drop - faster */
          82%  { transform: translateY(-10px); }   /* Fourth bounce back up - much faster */
          88%  { transform: translateY(0); }       /* Fifth drop */
          91%  { transform: translateY(-5px); }    /* Final tiny bounce back up */
          95%  { transform: translateY(0); }       /* Final settle */
          100% { transform: translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }
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

  // recalculate when childrens change
  useEffect(() => {
    const menuEl = menuRef.current;
    if (!menuEl) return;

    const updateHeight = () => setMenuHeight(menuEl.offsetHeight);

    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(menuEl);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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
