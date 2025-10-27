import React, { useEffect, useState, useRef } from 'react';

import {
  getWrapperStyle,
  getImageContentWrapperStyle,
  getImageSectionStyle,
  getOverlayStyle,
  getMenuStyle,
  getFormContainerStyle,
  getTitleStyle,
  getDescriptionStyle,
} from './AuthWall.styles.js';
import { VibesButton } from '../VibesButton/VibesButton.js';

const FALLBACK_IMAGE_URL =
  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80';

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

  // Set menu height on render
  useEffect(() => {
    if (menuRef.current) {
      setMenuHeight(menuRef.current.offsetHeight);
    }
  }, []);

  // Recalculate height when content changes
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

  // Handle opening animation with timer
  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsFadingOut(false);

      // Open menu after half a second
      const openTimeout = setTimeout(() => {
        setMenuOpen(true);
      }, 500);

      return () => clearTimeout(openTimeout);
    } else if (isVisible) {
      // Close menu first
      setMenuOpen(false);

      // After menu closes (400ms), start fade out
      const fadeTimeout = setTimeout(() => {
        setIsFadingOut(true);
      }, 400);

      // After fade out (500ms), hide completely
      const hideTimeout = setTimeout(() => {
        setIsVisible(false);
        setIsFadingOut(false);
      }, 900);

      return () => {
        clearTimeout(fadeTimeout);
        clearTimeout(hideTimeout);
      };
    }
  }, [open, isVisible]);

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
    transition: 'transform 0.9s ease, opacity 0.5s ease',
    transform: menuOpen ? `translateY(-${menuHeight}px)` : 'translateY(0)',
    opacity: isFadingOut ? 0 : 1,
  };

  // Menu style - always at bottom, with fade
  const menuStyle = {
    ...getMenuStyle(),
    transition: 'opacity 0.5s ease',
    opacity: isFadingOut ? 0 : 1,
  };

  return (
    <div style={getWrapperStyle()}>
      {/* Menu at bottom (like HiddenMenuWrapper menu) - always there */}
      <div ref={menuRef} style={menuStyle}>
        <div style={getFormContainerStyle()}>
          <h1 style={getTitleStyle()}>{title}</h1>
          <p style={getDescriptionStyle()}>Login to access this Vibe!</p>
          <VibesButton
            variant="primary"
            onClick={onLogin}
            onHover={() => setIsHovering(true)}
            onUnhover={() => setIsHovering(false)}
          >
            Login
          </VibesButton>
        </div>
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
