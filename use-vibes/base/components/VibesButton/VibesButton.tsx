import React, { useEffect, useState } from 'react';
import { getButtonStyle } from './VibesButton.styles.js';
import { useThemeDetection } from '../../hooks/useThemeDetection.js';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

export interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
  onHover?: () => void;
  onUnhover?: () => void;
}

export function VibesButton({
  variant = 'primary',
  children,
  onHover,
  onUnhover,
  style: customStyle,
  className,
  ...props
}: MenuButtonProps) {
  const [isHovered, setHovered] = useState(false);
  const [isActive, setActive] = useState(false);
  const isDark = useThemeDetection();

  useEffect(() => {
    if (isHovered) {
      onHover?.();
    } else {
      onUnhover?.();
    }
  }, [isHovered, onHover, onUnhover]);

  const baseStyle = getButtonStyle(variant, isHovered, isActive);
  const mergedStyle = {
    ...baseStyle,
    background: isDark ? '#1a1a1a' : '#fff',
    color: isDark ? '#fff' : '#1a1a1a',
    border: isDark ? '3px solid #555' : '3px solid #1a1a1a',
    ...customStyle,
  };

  return (
    <button
      {...props}
      className={className}
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
