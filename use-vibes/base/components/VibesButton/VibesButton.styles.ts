import type React from 'react';

// Map variant names to CSS variables that automatically adapt to dark mode
const variantColors: Record<string, string> = {
  blue: 'var(--vibes-variant-blue)',
  red: 'var(--vibes-variant-red)',
  yellow: 'var(--vibes-variant-yellow)',
  gray: 'var(--vibes-variant-gray)',
};

// Get the appropriate color based on variant
function getVariantColor(variant: string): string {
  return variantColors[variant] || variant;
}

// Bounce animation keyframes for icons
export const bounceKeyframes = `
  @keyframes vibes-button-bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }
`;

// Form button style - simple flat style with rounded corners
export function getFormButtonStyle(variant: string): React.CSSProperties {
  const cssColor = getVariantColor(variant);

  return {
    width: '100%',
    padding: '3px',
    backgroundColor: cssColor,
    border: '1px solid var(--vibes-button-border)',
    color: 'var(--vibes-button-text)',
    fontSize: '24px',
    fontWeight: 'bold',
    letterSpacing: '2px',
    cursor: 'pointer',
    transition: '0.2s',
    borderRadius: '20px',
    textTransform: 'none' as const,
  };
}

export function getButtonStyle(
  variant: string,
  isHovered: boolean,
  isActive: boolean,
  isMobile = false,
  hasIcon: boolean,
  buttonType: string
): React.CSSProperties {
  // Use form style for form button type
  if (buttonType === 'form') {
    return getFormButtonStyle(variant);
  }
  const cssColor = getVariantColor(variant);
  let transform = 'translate(0px, 0px)';
  let boxShadow = buttonType
    ? `4px 5px 0px 0px ${cssColor}, 4px 5px 0px 1px var(--vibes-button-border)`
    : `8px 10px 0px 0px ${cssColor}, 8px 10px 0px 2px var(--vibes-button-border)`;

  if (isHovered && !isActive) {
    transform = 'translate(2px, 2px)';
    boxShadow = `2px 3px 0px 0px ${cssColor}, 2px 3px 0px 2px var(--vibes-button-border)`;
  }

  if (isActive) {
    transform = 'translate(4px, 5px)';
    boxShadow = 'none';
  }

  return {
    width: !hasIcon ? 'auto' : isMobile ? '100%' : '130px',
    height: !hasIcon ? 'auto' : isMobile ? 'auto' : '135px',
    minHeight: isMobile ? '60px' : undefined,
    padding: isMobile ? (buttonType ? 'none' : '0.75rem 1.5rem') : '1rem 2rem',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    position: 'relative' as const,
    transform,
    boxShadow,
  };
}

export function getMergedButtonStyle(
  baseStyle: React.CSSProperties,
  ignoreDarkMode: boolean,
  customStyle?: React.CSSProperties,
  buttonType?: 'square' | 'flat' | 'flat-rounded' | 'form'
): React.CSSProperties {
  // Form buttons already have their complete styling, just merge custom styles
  if (buttonType === 'form') {
    return {
      ...baseStyle,
      ...customStyle,
    };
  }

  const style: React.CSSProperties = {
    ...baseStyle,
    background: ignoreDarkMode ? 'var(--vibes-button-bg)' : 'var(--vibes-button-bg-dark-aware)',
    color: ignoreDarkMode ? 'var(--vibes-button-text)' : 'var(--vibes-button-text-dark-aware)',
    border: ignoreDarkMode
      ? '2px solid var(--vibes-button-border)'
      : '2px solid var(--vibes-button-border-dark-aware)',
  };

  // Apply 50% border radius for flat-rounded type
  if (buttonType === 'flat-rounded') {
    style.borderRadius = '50px';
  }

  return {
    ...style,
    ...customStyle,
  };
}

export function getIconContainerStyle(
  variant: string,
  isMobile: boolean,
  hasIcon: boolean,
  buttonType: string
): React.CSSProperties {
  if (!hasIcon) return {};

  const cssColor = getVariantColor(variant);

  return {
    width: isMobile ? '48px' : '80px',
    height: isMobile ? '48px' : '80px',
    backgroundColor: buttonType === 'flat-rounded' ? 'none' : cssColor,
    borderRadius: buttonType === 'flat-rounded' ? 'none' : '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: buttonType === 'flat-rounded' ? 'none' : '2px solid var(--vibes-black)',
  };
}

export function getIconStyle(
  isMobile: boolean,
  isHovered: boolean,
  isActive: boolean
): React.CSSProperties {
  return {
    width: isMobile ? '28px' : '50px',
    height: isMobile ? '28px' : '50px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: isHovered && !isActive ? 'vibes-button-bounce 0.8s ease-in-out infinite' : 'none',
  };
}

export function getContentWrapperStyle(isMobile: boolean, hasIcon: boolean): React.CSSProperties {
  if (!hasIcon) return {};

  return {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '16px' : '6px',
    flexDirection: isMobile ? ('row' as const) : ('column' as const),
    justifyContent: isMobile ? ('flex-start' as const) : ('center' as const),
    width: '100%',
  };
}
