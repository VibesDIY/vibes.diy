import React, { useEffect, useState, useRef } from 'react';

import {
  getWrapperStyle,
  getImageContentWrapperStyle,
  getImageSectionStyle,
  getOverlayStyle,
  getMenuStyle,
  getTitleStyle,
  getDescriptionStyle,
} from './AuthWall.styles.js';
import { VibesButton } from '../VibesButton/VibesButton.js';
import { BrutalistCard } from '../BrutalistCard/BrutalistCard.js';

const FALLBACK_IMAGE_URL =
  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80';

// Animation timing constants (centralized for consistency between CSS and JS)
const MENU_OPEN_DELAY_MS = 500;
const MENU_SLIDE_DURATION_MS = 900; // matches 0.9s
const FADE_OUT_DURATION_MS = 500; // matches 0.5s

export interface AuthWallProps {
  onLogin: () => void;
  imageUrl: string;
  title: string;
  open: boolean;
}

export function AuthWall({ onLogin, imageUrl, title, open }: AuthWallProps) {
  const [isVisible, setIsVisible] = useState(open);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [menuHeight, setMenuHeight] = useState(0);
  const [actualImageUrl, setActualImageUrl] = useState(imageUrl);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevOpenRef = useRef<boolean | undefined>(undefined);
  const prevMenuHeightRef = useRef(0);

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Set menu height whenever component becomes visible
  useEffect(() => {
    if (!isVisible) return;

    if (menuRef.current) {
      setMenuHeight(menuRef.current.offsetHeight);
    }
  }, [isVisible]);

  // Recalculate height when content changes
  useEffect(() => {
    if (!isVisible) return;

    const menuEl = menuRef.current;
    if (!menuEl) return;

    const updateHeight = () => setMenuHeight(menuEl.offsetHeight);
    updateHeight();

    let ro: ResizeObserver | null = null;
    const hasRO = typeof window !== 'undefined' && 'ResizeObserver' in window;

    if (hasRO) {
      ro = new ResizeObserver(() => {
        updateHeight();
      });
      ro.observe(menuEl);
    } else {
      window.addEventListener('resize', updateHeight);
    }

    return () => {
      if (ro) {
        ro.disconnect();
      } else {
        window.removeEventListener('resize', updateHeight);
      }
    };
  }, [isVisible]);

  // Handle opening animation with timer
  useEffect(() => {
    const prevOpen = prevOpenRef.current;
    const openChanged = prevOpen !== open;
    const menuHeightBecameAvailable = prevMenuHeightRef.current === 0 && menuHeight > 0;

    prevOpenRef.current = open;
    prevMenuHeightRef.current = menuHeight;

    // Only run if open changed or menuHeight just became available (for initial load)
    if (!openChanged && !menuHeightBecameAvailable) return;

    // Clear all pending timeouts from previous state changes
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    // Skip animations if user prefers reduced motion
    if (prefersReducedMotion) {
      setIsVisible(open);
      setMenuOpen(open);
      setIsFadingOut(false);
      return;
    }

    if (open) {
      // Opening animation
      setIsVisible(true);
      setIsFadingOut(false);
      setMenuOpen(false);

      // Only start animation if menuHeight is calculated
      if (menuHeight > 0) {
        // Open menu after configured delay
        const openTimeout = setTimeout(() => {
          setMenuOpen(true);
        }, MENU_OPEN_DELAY_MS);
        timeoutsRef.current.push(openTimeout);
      }
    } else {
      // Avoid closing timers on initial closed state
      if (!prevOpen) return;

      // Closing animation
      setMenuOpen(false);

      // After menu slides closed, start fade out
      const fadeTimeout = setTimeout(() => {
        setIsFadingOut(true);
      }, MENU_SLIDE_DURATION_MS);
      timeoutsRef.current.push(fadeTimeout);

      // After fade out completes, hide completely
      const hideTimeout = setTimeout(() => {
        setIsVisible(false);
        setIsFadingOut(false);
      }, MENU_SLIDE_DURATION_MS + FADE_OUT_DURATION_MS);
      timeoutsRef.current.push(hideTimeout);
    }
  }, [open, menuHeight, prefersReducedMotion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  // Preload and handle fallback for any imageUrl
  useEffect(() => {
    // Guard against falsy imageUrl to avoid spurious requests
    if (!imageUrl) {
      setActualImageUrl(FALLBACK_IMAGE_URL);
      return;
    }

    let canceled = false;
    const img = new Image();

    img.onload = () => {
      if (!canceled) setActualImageUrl(imageUrl);
    };

    img.onerror = () => {
      if (!canceled) {
        // Fallback for any failed image URL
        setActualImageUrl(FALLBACK_IMAGE_URL);
      }
    };

    img.src = imageUrl;

    return () => {
      canceled = true;
    };
  }, [imageUrl]);

  if (!isVisible) return null;

  // Overlay style with dynamic blur based on hover
  const overlayStyle = {
    ...getOverlayStyle(),
    transition: 'backdrop-filter 0.4s ease',
    backdropFilter: isHovering ? 'blur(4px)' : 'blur(12px)',
  };

  // Image content wrapper style - slides up to reveal menu (like HiddenMenuWrapper content)
  const imageContentWrapperStyle = {
    ...getImageContentWrapperStyle(),
    transition: prefersReducedMotion
      ? 'none'
      : `transform ${MENU_SLIDE_DURATION_MS / 1000}s ease, opacity ${FADE_OUT_DURATION_MS / 1000}s ease`,
    transform: menuOpen ? `translateY(-${menuHeight}px)` : 'translateY(0)',
    opacity: isFadingOut ? 0 : 1,
    willChange: 'transform, opacity',
  };

  // Menu style - always at bottom, with fade
  const menuStyle = {
    ...getMenuStyle(),
    transition: prefersReducedMotion ? 'none' : `opacity ${FADE_OUT_DURATION_MS / 1000}s ease`,
    opacity: isFadingOut ? 0 : 1,
  };

  return (
    <div style={getWrapperStyle()}>
      {/* Menu at bottom (like HiddenMenuWrapper menu) - always there */}
      <div ref={menuRef} style={menuStyle}>
        <BrutalistCard
          size="lg"
          style={{
            position: 'relative',
            textAlign: 'left',
            maxWidth: '400px',
            width: '90%',
          }}
        >
          <h1 style={getTitleStyle()}>{title}</h1>
          <p style={getDescriptionStyle()}>Login to access this Vibe!</p>
          <VibesButton
            color="blue"
            onClick={onLogin}
            onHover={() => setIsHovering(true)}
            onUnhover={() => setIsHovering(false)}
          >
            Login
          </VibesButton>
        </BrutalistCard>
      </div>

      {/* Image content wrapper (like HiddenMenuWrapper content) - slides up to reveal menu */}
      <div style={imageContentWrapperStyle}>
        <div style={getImageSectionStyle(actualImageUrl)}>
          <div style={overlayStyle} />
        </div>
      </div>
    </div>
  );
}
