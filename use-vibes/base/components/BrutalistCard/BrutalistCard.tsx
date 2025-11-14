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
    // Detect dark mode
    const [isDark, setIsDark] = React.useState(false);

    React.useEffect(() => {
      const checkDarkMode = () => {
        setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
      };

      checkDarkMode();
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', checkDarkMode);

      return () => mediaQuery.removeEventListener('change', checkDarkMode);
    }, []);

    const cardStyle = {
      ...getBrutalistCardStyle(variant, size),
      background: isDark ? '#1a1a1a' : '#fff',
      color: isDark ? '#fff' : '#1a1a1a',
      border: isDark ? '3px solid #555' : '3px solid #1a1a1a',
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
