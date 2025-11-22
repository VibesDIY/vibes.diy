import React, { useState, useEffect } from 'react';
import {
  getResponsiveContainerStyle,
  getResponsiveLabelStyle,
  getResponsiveButtonWrapperStyle,
} from './VibesPanel.styles.js';

export interface LabelContainerProps {
  /** The label text to display on the side of the container */
  label?: string;
  /** Child elements to render inside the container */
  children: React.ReactNode;
  /** Optional custom styling for the outer container */
  style?: React.CSSProperties;
  /** Optional className for the outer container */
  className?: string;
}

/**
 * LabelContainer - A card-like container with an optional vertical label
 *
 * This component wraps content in a brutalist-styled card with an optional
 * vertical label on the side. The label is hidden on mobile devices.
 */
export function LabelContainer({ label, children, style, className }: LabelContainerProps) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  );

  // Listen for window resize to update mobile state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return (
    <div style={{ ...getResponsiveContainerStyle(isMobile), ...style }} className={className}>
      {label && <div style={getResponsiveLabelStyle(isMobile)}>{label}</div>}
      <div style={getResponsiveButtonWrapperStyle(isMobile)}>{children}</div>
    </div>
  );
}
