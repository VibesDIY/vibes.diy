/**
 * TokensEditor Component Types
 */

export type TokenType = 'color' | 'typography' | 'spacing' | 'radius' | 'shadow' | 'effect' | 'breakpoint';

// CSS Units for numeric values
export type CSSUnit = 'px' | '%' | 'rem' | 'em' | 'vw' | 'vh' | 'vmin' | 'vmax' | 'ch';

// Numeric value with unit
export interface NumericValue {
  value: number;
  unit: CSSUnit;
}

export interface ColorToken {
  id: string;
  name: string;
  variable: string;
  lightValue: string;
  darkValue: string;
  category: string;
}

export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export interface TypographyToken {
  id: string;
  name: string;
  variable: string;
  color: string;
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  letterSpacing: string;
  textTransform?: TextTransform;
}

// Spacing tokens for margins, paddings, gaps
export interface SpacingToken {
  id: string;
  name: string;
  variable: string;
  value: number;
  unit: CSSUnit;
  category: 'margin' | 'padding' | 'gap' | 'custom';
}

// Border radius tokens
export interface RadiusToken {
  id: string;
  name: string;
  variable: string;
  value: number;
  unit: CSSUnit;
  // For individual corners
  topLeft?: NumericValue;
  topRight?: NumericValue;
  bottomRight?: NumericValue;
  bottomLeft?: NumericValue;
  isIndividual: boolean; // true = use individual corners, false = use single value
}

// Shadow tokens for box-shadow
export interface ShadowToken {
  id: string;
  name: string;
  variable: string;
  layers: ShadowLayer[];
}

export interface ShadowLayer {
  id: string;
  offsetX: NumericValue;
  offsetY: NumericValue;
  blur: NumericValue;
  spread: NumericValue;
  color: string; // Reference to color token variable or hex value
  inset: boolean;
}

// Effect tokens for pseudo-elements and animations
export interface EffectToken {
  id: string;
  name: string;
  variable: string;
  type: 'before' | 'after' | 'transition' | 'animation';
  // For ::before and ::after
  content?: string;
  position?: 'absolute' | 'relative' | 'fixed';
  top?: NumericValue;
  right?: NumericValue;
  bottom?: NumericValue;
  left?: NumericValue;
  width?: NumericValue;
  height?: NumericValue;
  backgroundColor?: string;
  borderRadius?: string; // Reference to radius token
  opacity?: number;
  zIndex?: number;
  // For transitions
  transitionProperty?: string;
  transitionDuration?: NumericValue;
  transitionTimingFunction?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier';
  transitionDelay?: NumericValue;
  // For animations
  animationName?: string;
  animationDuration?: NumericValue;
  animationTimingFunction?: string;
  animationIterationCount?: number | 'infinite';
  animationDirection?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
}

// Responsive breakpoint tokens
export interface BreakpointToken {
  id: string;
  name: string;
  variable: string;
  minWidth?: NumericValue;
  maxWidth?: NumericValue;
  orientation?: 'portrait' | 'landscape';
  // Predefined device presets
  preset?: 'mobile' | 'tablet' | 'desktop' | 'wide' | 'custom';
}

export interface TokensEditorProps {
  /**
   * Callback when tokens are updated
   */
  onTokenChange?: (variable: string, value: string) => void;
}

// Helper to convert NumericValue to CSS string
export function numericValueToCSS(val: NumericValue): string {
  return `${val.value}${val.unit}`;
}

// Helper to parse CSS value to NumericValue
export function cssToNumericValue(css: string): NumericValue {
  const match = css.match(/^(-?\d*\.?\d+)(.*)$/);
  if (match) {
    return {
      value: parseFloat(match[1]),
      unit: (match[2] || 'px') as CSSUnit,
    };
  }
  return { value: 0, unit: 'px' };
}
