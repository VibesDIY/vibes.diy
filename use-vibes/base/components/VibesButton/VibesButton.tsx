import React, { useEffect, useState } from 'react';
import { getButtonStyle } from './VibesButton.styles.js';
import { usePrefersDarkMode } from '../../hooks/usePrefersDarkMode.js';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

export interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
  onHover?: () => void;
  onUnhover?: () => void;
  /** If true, ignores dark mode and always uses light styling */
  ignoreDarkMode?: boolean;
}

export function VibesButton({
  variant = 'primary',
  children,
  onHover,
  onUnhover,
  ignoreDarkMode = false,
  style: customStyle,
  className,
  ...props
}: MenuButtonProps) {
  const [isHovered, setHovered] = useState(false);
  const [isActive, setActive] = useState(false);
  const isDark = usePrefersDarkMode(ignoreDarkMode);

  useEffect(() => {
    if (isHovered) {
      onHover?.();
    } else {
      onUnhover?.();
    }
  }, [isHovered, onHover, onUnhover]);

  const shouldApplyDarkMode = isDark && !ignoreDarkMode;

  const baseStyle = getButtonStyle(variant, isHovered, isActive);
  const mergedStyle = {
    ...baseStyle,
    background: shouldApplyDarkMode ? '#1a1a1a' : '#fff',
    color: shouldApplyDarkMode ? '#fff' : '#1a1a1a',
    border: shouldApplyDarkMode ? '3px solid #555' : '3px solid #1a1a1a',
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
