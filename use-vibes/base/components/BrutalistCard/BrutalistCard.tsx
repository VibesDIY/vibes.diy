import React from 'react';
import { getBrutalistCardStyle } from './BrutalistCard.styles.js';
import type { BrutalistCardVariant, BrutalistCardSize } from './BrutalistCard.styles.js';

export interface BrutalistCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content to render inside the card */
  children: React.ReactNode;
  /** Visual variant affecting shadow color */
  variant?: BrutalistCardVariant;
  /** Size affecting padding, font size, and shadow size */
  size?: BrutalistCardSize;
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
export const BrutalistCard = React.forwardRef<HTMLDivElement, BrutalistCardProps>(
  (
    {
      children,
      variant = 'default',
      size = 'md',
      style,
      className,
      ...divProps
    }: BrutalistCardProps,
    ref
  ) => {
    const cardStyle: React.CSSProperties = {
      ...getBrutalistCardStyle(variant, size),
      ...style,
    };

    return (
      <div ref={ref} style={cardStyle} className={className} {...divProps}>
        {children}
      </div>
    );
  }
);

BrutalistCard.displayName = 'BrutalistCard';
