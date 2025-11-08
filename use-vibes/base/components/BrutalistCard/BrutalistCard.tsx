import React from 'react';
import {
  getBrutalistCardStyle,
  BrutalistCardVariant,
  BrutalistCardSize,
} from './BrutalistCard.styles.js';

export interface BrutalistCardProps {
  /** Content to render inside the card */
  children: React.ReactNode;
  /** Visual variant affecting shadow color */
  variant?: BrutalistCardVariant;
  /** Size affecting padding, font size, and shadow size */
  size?: BrutalistCardSize;
  /** Additional custom styles */
  style?: React.CSSProperties;
  /** Optional className for the card */
  className?: string;
  /** Optional HTML attributes for the div */
  [key: string]: unknown;
}

/**
 * BrutalistCard - A card component with brutalist design aesthetic
 *
 * Features:
 * - Thick border and shadow
 * - Clean white background
 * - Configurable size and variant
 * - Consistent styling across auth UI
 *
 * @example
 * ```tsx
 * <BrutalistCard size="lg" variant="default">
 *   <h1>Login</h1>
 *   <p>Welcome back!</p>
 * </BrutalistCard>
 * ```
 */
export function BrutalistCard({
  children,
  variant = 'default',
  size = 'md',
  style,
  className,
  ...rest
}: BrutalistCardProps) {
  const cardStyle = {
    ...getBrutalistCardStyle(variant, size),
    ...style,
  };

  return (
    <div style={cardStyle} className={className} {...rest}>
      {children}
    </div>
  );
}
