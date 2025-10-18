import React, { useEffect, useState } from 'react';

import {
  getWrapperStyle,
  getOverlayStyle,
  getFormContainerStyle,
  getTitleStyle,
  getDescriptionStyle,
} from './AuthWall.styles.js';
import { VibesButton } from '../VibesButton/VibesButton.js';

export interface AuthWallProps {
  onLogin: () => void;
  imageUrl: string;
  title: string;
  open: boolean;
}

export function AuthWall({ onLogin, imageUrl, title, open }: AuthWallProps) {
  const [isVisible, setIsVisible] = useState(open);
  const [formVisible, setFormVisible] = useState(open);
  const [overlayVisible, setOverlayVisible] = useState(open);
  const [isHovering, setIsHovering] = useState(false);
  const [actualImageUrl, setActualImageUrl] = useState(
    imageUrl === '/screenshot.png' 
      ? '/screenshot.png'
      : imageUrl
  );

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setFormVisible(true);

      const showOverlayTimeout = setTimeout(() => {
        setOverlayVisible(true);
      }, 500);

      return () => clearTimeout(showOverlayTimeout);
    } else {
      setOverlayVisible(false);

      const hideFormTimeout = setTimeout(() => {
        setFormVisible(false);
      }, 500);

      const hideAllTimeout = setTimeout(() => {
        setIsVisible(false);
      }, 1000);

      return () => {
        clearTimeout(hideFormTimeout);
        clearTimeout(hideAllTimeout);
      };
    }
  }, [open]);

  const handleImageError = () => {
    if (actualImageUrl === '/screenshot.png') {
      setActualImageUrl(
        'https://images.unsplash.com/photo-1518837695005-2083093ee35b?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80'
      );
    }
  };

  if (!isVisible) return null;

  // Overlay style with dynamic blur based on hover
  const overlayStyle = {
    ...getOverlayStyle(),
    transition: 'opacity 0.5s ease, backdrop-filter 0.4s ease',
    opacity: overlayVisible ? 1 : 0,
    backdropFilter: isHovering ? 'blur(4px)' : 'blur(12px)',
  };

  const formContainerStyle = {
    ...getFormContainerStyle(),
    transition: 'transform 0.5s ease-out, opacity 1.5s ease-out',
    transform: formVisible ? 'translateY(0)' : 'translateY(-300%)',
    opacity: formVisible ? 1 : 0,
  };

  return (
    <div style={getWrapperStyle(actualImageUrl)}>
      <img
        src={actualImageUrl}
        onError={handleImageError}
        style={{ display: 'none' }}
        alt=""
      />
      <div style={overlayStyle} />
      <div style={formContainerStyle}>
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
  );
}
