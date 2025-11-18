import React from 'react';
import { getBrutalistCardStyle } from './BrutalistCard.styles.js';
import type { BrutalistCardVariant, BrutalistCardSize } from './BrutalistCard.styles.js';
import { usePrefersDarkMode } from '../../hooks/usePrefersDarkMode.js';

export interface BrutalistCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content to render inside the card */
  children: React.ReactNode;
  /** Visual variant affecting shadow color */
  variant?: BrutalistCardVariant;
  /** Size affecting padding, font size, and shadow size */
  size?: BrutalistCardSize;
  /** Message type for chat bubble corner rounding */
  messageType?: 'user' | 'ai';
  /** If true, ignores dark mode and always uses light styling */
  ignoreDarkMode?: boolean;
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
      messageType,
      ignoreDarkMode = false,
      style,
      className,
      ...divProps
    }: BrutalistCardProps,
    ref
  ) => {
    const isDark = usePrefersDarkMode(ignoreDarkMode);
    const shouldApplyDarkMode = isDark && !ignoreDarkMode;

    const cardStyle = {
      ...getBrutalistCardStyle(variant, size, messageType),
      background: shouldApplyDarkMode ? '#1a1a1a' : '#fff',
      color: shouldApplyDarkMode ? '#fff' : '#1a1a1a',
      border: shouldApplyDarkMode ? '3px solid #555' : '3px solid #1a1a1a',
      ...style,
    } as React.CSSProperties;

    return (
      <div ref={ref} style={cardStyle} className={className} {...divProps}>
        {children}
      </div>
    );
  }
);

BrutalistCard.displayName = 'BrutalistCard';
