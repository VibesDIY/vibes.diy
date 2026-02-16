import React from "react";
import { LabelContainerStyles } from "./LabelContainer.styles.js";
import { useMobile } from "../hooks/useMobile.js";

export interface LabelContainerProps {
  /** The label text to display on the side of the container */
  readonly label?: string;
  /** Child elements to render inside the container */
  readonly children: React.ReactNode;
  /** Optional custom styling for the outer container */
  readonly style?: React.CSSProperties;
  /** Optional className for the outer container */
  readonly className?: string;
  /** If true, label disappears on mobile. If false, label moves to top on mobile. Default: false */
  readonly disappear?: boolean;
}

/**
 * LabelContainer - A card-like container with an optional vertical label
 *
 * This component wraps content in a brutalist-styled card with an optional
 * vertical label on the side. The label is hidden on mobile devices.
 */
export function LabelContainer({ label, children, style, className, disappear = false }: LabelContainerProps) {
  const isMobile = useMobile();

  return (
    <div style={{ ...LabelContainerStyles.getResponsiveContainerStyle(isMobile), ...style }} className={className}>
      {label && <div style={LabelContainerStyles.getResponsiveLabelStyle(isMobile, disappear)}>{label}</div>}
      <div style={LabelContainerStyles.getResponsiveButtonLabelWrapperStyle(isMobile, disappear)}>{children}</div>
    </div>
  );
}
