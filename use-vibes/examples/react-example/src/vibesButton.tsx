import React, { useState } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

const variantShadows: Record<ButtonVariant, string> = {
  primary: '#009ACE',
  secondary: '#DA291C',
  tertiary: '#FEDD00',
};

export default function VibesButton({ variant = 'primary', children, ...props }: MenuButtonProps) {
  const [isHovered, setHovered] = useState(false);
  const [isActive, setActive] = useState(false);

  const baseStyle: React.CSSProperties = {
    width: '100%',
    padding: '1rem 2rem',
    background: '#fff',
    color: '#1a1a1a',
    border: '3px solid #1a1a1a',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    position: 'relative',
    transform: 'translate(0px, 0px)',
    boxShadow: `4px 5px 0px 0px ${variantShadows[variant]}`,
  };

  // Hover effect
  if (isHovered && !isActive) {
    baseStyle.transform = 'translate(2px, 2px)';
    baseStyle.boxShadow = `2px 3px 0px 0px ${variantShadows[variant]}`;
  }

  // Active (pressed) effect
  if (isActive) {
    baseStyle.transform = 'translate(4px, 5px)';
    baseStyle.boxShadow = `0px 0px 0px 0px ${variantShadows[variant]}`;
  }

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
      style={baseStyle}
    >
      {children}
    </button>
  );
}
