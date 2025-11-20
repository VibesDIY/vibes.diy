import type React from 'react';

const colorMap: Record<string, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  yellow: '#eab308',
  gray: '#6b7280',
};

// Bounce animation keyframes
export const bounceKeyframes = `
  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }
`;

export function getButtonStyle(
  color: string,
  isHovered: boolean,
  isActive: boolean,
  isMobile = false
): React.CSSProperties {
  const hexColor = colorMap[color] || color;
  let transform = 'translate(0px, 0px)';
  let boxShadow = `8px 10px 0px 0px ${hexColor}, 8px 10px 0px 2px #1a1a1a`;

  if (isHovered && !isActive) {
    transform = 'translate(2px, 2px)';
    boxShadow = `2px 3px 0px 0px ${hexColor}, 2px 3px 0px 2px #1a1a1a`;
  }

  if (isActive) {
    transform = 'translate(4px, 5px)';
    boxShadow = 'none';
  }

  return {
    width: isMobile ? '100%' : '150px',
    height: isMobile ? 'auto' : '150px',
    minHeight: isMobile ? '60px' : undefined,
    padding: isMobile ? '0.75rem 1.5rem' : '1rem 2rem',
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
  isDark: boolean,
  customStyle?: React.CSSProperties
): React.CSSProperties {
  return {
    ...baseStyle,
    background: isDark ? '#FFFFF0' : '#FFFFF0',
    color: isDark ? '#1a1a1a' : '#1a1a1a',
    border: isDark ? '2px solid #1a1a1a' : '2px solid #1a1a1a',
    ...customStyle,
  };
}

export function getIconContainerStyle(
  hexColor: string,
  isMobile: boolean,
  hasIcon: boolean
): React.CSSProperties {
  if (!hasIcon) return {};

  return {
    width: isMobile ? '48px' : '80px',
    height: isMobile ? '48px' : '80px',
    backgroundColor: hexColor,
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '2px solid black',
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
    objectFit: 'contain' as const,
    backgroundColor: 'white',
    borderRadius: '50%',
    animation: isHovered && !isActive ? 'bounce 0.8s ease-in-out infinite' : 'none',
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