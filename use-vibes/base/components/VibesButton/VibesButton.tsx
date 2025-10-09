import React, { useState } from 'react';
import { getButtonStyle } from './VibesButton.styles.js';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

export interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

export function VibesButton({ variant = 'primary', children, ...props }: MenuButtonProps) {
  const [isHovered, setHovered] = useState(false);
  const [isActive, setActive] = useState(false);

  const style = getButtonStyle(variant, isHovered, isActive);

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
      style={style}
    >
      {children}
    </button>
  );
}
