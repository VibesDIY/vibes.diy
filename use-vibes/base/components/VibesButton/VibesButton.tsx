import React, { useEffect, useState } from 'react';
import { getButtonStyle, ButtonSize } from './VibesButton.styles.js';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

export interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  onHover?: () => void;
  onUnhover?: () => void;
}

export function VibesButton({
  variant = 'primary',
  size = 'default',
  children,
  onHover,
  onUnhover,
  style: customStyle,
  ...props
}: MenuButtonProps) {
  const [isHovered, setHovered] = useState(false);
  const [isActive, setActive] = useState(false);

  const baseStyle = getButtonStyle(variant, isHovered, isActive, size);
  const mergedStyle = { ...baseStyle, ...customStyle };

  useEffect(() => {
    if (isHovered) {
      onHover?.();
    } else {
      onUnhover?.();
    }
  }, [isHovered, onHover, onUnhover]);

  return (
    <button
      {...props}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={mergedStyle}
    >
      {children}
    </button>
  );
}
