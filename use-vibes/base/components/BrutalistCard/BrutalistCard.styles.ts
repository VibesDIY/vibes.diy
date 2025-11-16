import { CSSProperties } from 'react';

export type BrutalistCardVariant = 'default' | 'success' | 'error' | 'warning';
export type BrutalistCardSize = 'sm' | 'md' | 'lg';

/**
 * Get shadow color based on variant
 */
function getShadowColor(variant: BrutalistCardVariant): string {
  switch (variant) {
    case 'success':
      return '#51cf66'; // Green
    case 'error':
      return '#DA291C'; // Red
    case 'warning':
      return '#FEDD00'; // Yellow
    case 'default':
    default:
      return '#1a1a1a'; // Dark gray
  }
}

/**
 * Get padding based on size
 */
function getPadding(size: BrutalistCardSize): string {
  switch (size) {
    case 'sm':
      return '0.75rem 1rem';
    case 'md':
      return '1rem';
    case 'lg':
      return '2rem 3rem';
    default:
      return '1rem';
  }
}

/**
 * Get font size based on size
 */
function getFontSize(size: BrutalistCardSize): string {
  switch (size) {
    case 'sm':
      return '0.875rem';
    case 'md':
      return '1rem';
    case 'lg':
      return '1rem';
    default:
      return '1rem';
  }
}

/**
 * Get box shadow based on size and variant
 */
function getBoxShadow(size: BrutalistCardSize, variant: BrutalistCardVariant): string {
  const color = getShadowColor(variant);

  switch (size) {
    case 'sm':
      return `2px 3px 0px 0px ${color}`;
    case 'md':
      return `4px 5px 0px 0px ${color}`;
    case 'lg':
      return `6px 6px 0px 0px ${color}`;
    default:
      return `4px 5px 0px 0px ${color}`;
  }
}

/**
 * Get border radius based on message type
 */
function getBorderRadius(messageType?: 'user' | 'ai'): string {
  switch (messageType) {
    case 'user':
      return '12px 12px 0 12px'; // Bottom-right not rounded
    case 'ai':
      return '12px 12px 12px 0'; // Bottom-left not rounded
    default:
      return '12px'; // All corners rounded
  }
}

/**
 * Get the brutalist card style
 */
export function getBrutalistCardStyle(
  variant: BrutalistCardVariant = 'default',
  size: BrutalistCardSize = 'md',
  messageType?: 'user' | 'ai'
): CSSProperties {
  return {
    // background, color, and border are now controlled by CSS classes for dark mode support
    borderRadius: getBorderRadius(messageType),
    padding: getPadding(size),
    fontSize: getFontSize(size),
    fontWeight: 500,
    letterSpacing: '0.02em',
    boxShadow: getBoxShadow(size, variant),
    transition: 'box-shadow 0.15s ease, transform 0.15s ease',
    boxSizing: 'border-box' as const,
  };
}
