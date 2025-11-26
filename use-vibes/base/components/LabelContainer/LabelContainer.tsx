import React from 'react';
import {
  getResponsiveContainerStyle,
  getResponsiveLabelStyle,
  getResponsiveButtonWrapperStyle,
} from './LabelContainer.styles.js';
import { useMobile } from '../../hooks/useMobile.js';

export interface LabelContainerProps {
  /** The label text to display on the side of the container */
  label?: string;
  /** Child elements to render inside the container */
  children: React.ReactNode;
  /** Optional custom styling for the outer container */
  style?: React.CSSProperties;
  /** Optional className for the outer container */
  className?: string;
  /** If true, label disappears on mobile. If false, label moves to top on mobile. Default: false */
  disappear?: boolean;
}

/**
 * LabelContainer - A card-like container with an optional vertical label
 *
 * This component wraps content in a brutalist-styled card with an optional
 * vertical label on the side. The label is hidden on mobile devices.
 */
export function LabelContainer({
  label,
  children,
  style,
  className,
  disappear = false,
}: LabelContainerProps) {
  const isMobile = useMobile();

  return (
    <div style={{ ...getResponsiveContainerStyle(isMobile), ...style }} className={className}>
      {label && <div style={getResponsiveLabelStyle(isMobile, disappear)}>{label}</div>}
      <div style={getResponsiveButtonWrapperStyle(isMobile, disappear)}>{children}</div>
    </div>
  );
}
