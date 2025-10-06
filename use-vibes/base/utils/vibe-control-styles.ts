/**
 * VibeControl Component Styling Constants
 * Following the same pattern as ImgGen styles for consistency
 *
 * Dark mode support:
 * Override CSS variables in your stylesheet using:
 *
 * @media (prefers-color-scheme: dark) {
 *   :root {
 *     --vc-button-bg: #4a90e2;
 *     --vc-button-bg-hover: #357abd;
 *     --vc-overlay-bg: #1a1a1a;
 *     --vc-overlay-text: #e0e0e0;
 *     --vc-overlay-border: #404040;
 *     --vc-close-bg: #2a2a2a;
 *     --vc-close-bg-hover: #404040;
 *     --vc-close-text: #cccccc;
 *   }
 * }
 */

// Position type for VibeControl button
export type VibeControlPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

// CSS Custom Properties (Variables) as JavaScript constants with fallbacks
export const vibeControlTheme = {
  // Colors with dark mode support using CSS variables with fallbacks
  colors: {
    buttonBg: 'var(--vc-button-bg, #0066cc)',
    buttonBgHover: 'var(--vc-button-bg-hover, #0052a3)',
    buttonText: 'var(--vc-button-text, #ffffff)',
    buttonBorder: 'var(--vc-button-border, #0066cc)',

    overlayBackdrop: 'var(--vc-overlay-backdrop, rgba(0, 0, 0, 0.5))',
    overlayBg: 'var(--vc-overlay-bg, #ffffff)',
    overlayText: 'var(--vc-overlay-text, #333333)',
    overlayBorder: 'var(--vc-overlay-border, #e0e0e0)',

    closeButtonBg: 'var(--vc-close-bg, #f5f5f5)',
    closeButtonBgHover: 'var(--vc-close-bg-hover, #e0e0e0)',
    closeButtonText: 'var(--vc-close-text, #666666)',

    accent: 'var(--vc-accent, #0066cc)',
    shadow: 'var(--vc-shadow, rgba(0, 0, 0, 0.15))',
  },

  // Dimensions
  dimensions: {
    buttonWidth: '120px',
    buttonHeight: '40px',
    buttonPadding: '8px 16px',
    buttonBorderRadius: '20px',
    buttonPosition: '20px', // Distance from edge

    overlayPadding: '24px',
    overlayBorderRadius: '12px',
    overlayMaxWidth: '800px',
    overlayMaxHeight: '90vh',

    closeButtonSize: '32px',
    closeButtonBorderRadius: '16px',
  },

  // Typography
  typography: {
    buttonFontSize: '14px',
    buttonFontWeight: '600',
    buttonLineHeight: '1.2',

    overlayTitleFontSize: '24px',
    overlayTitleFontWeight: '700',
    overlayTitleLineHeight: '1.3',

    overlayBodyFontSize: '16px',
    overlayBodyLineHeight: '1.5',
  },

  // Effects
  effects: {
    buttonShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    buttonShadowHover: '0 4px 12px rgba(0, 0, 0, 0.2)',
    overlayShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    transition: '0.2s ease-in-out',
    backdropFilter: 'blur(4px)',
  },

  // Z-index layers
  zIndex: {
    button: 1000,
    overlay: 1100,
    backdrop: 1050,
  },
};

// Utility function to create inline styles
export const createVibeControlStyles = (position: VibeControlPosition = 'bottom-right') => {
  const pos = vibeControlTheme.dimensions.buttonPosition;
  const anchor: Record<string, string> = {};

  switch (position) {
    case 'bottom-right':
      anchor.bottom = pos;
      anchor.right = pos;
      break;
    case 'bottom-left':
      anchor.bottom = pos;
      anchor.left = pos;
      break;
    case 'top-right':
      anchor.top = pos;
      anchor.right = pos;
      break;
    case 'top-left':
      anchor.top = pos;
      anchor.left = pos;
      break;
  }

  return {
    button: {
      position: 'fixed' as const,
      ...anchor,
      width: vibeControlTheme.dimensions.buttonWidth,
      height: vibeControlTheme.dimensions.buttonHeight,
      padding: vibeControlTheme.dimensions.buttonPadding,
      backgroundColor: vibeControlTheme.colors.buttonBg,
      color: vibeControlTheme.colors.buttonText,
      border: `1px solid ${vibeControlTheme.colors.buttonBorder}`,
      borderRadius: vibeControlTheme.dimensions.buttonBorderRadius,
      fontSize: vibeControlTheme.typography.buttonFontSize,
      fontWeight: vibeControlTheme.typography.buttonFontWeight,
      lineHeight: vibeControlTheme.typography.buttonLineHeight,
      cursor: 'pointer',
      boxShadow: vibeControlTheme.effects.buttonShadow,
      transition: `background-color ${vibeControlTheme.effects.transition}, box-shadow ${vibeControlTheme.effects.transition}, transform ${vibeControlTheme.effects.transition}`,
      zIndex: vibeControlTheme.zIndex.button,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      userSelect: 'none' as const,
    },

    buttonHover: {
      backgroundColor: vibeControlTheme.colors.buttonBgHover,
      boxShadow: vibeControlTheme.effects.buttonShadowHover,
      transform: 'translateY(-2px)',
    },

    backdrop: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: vibeControlTheme.colors.overlayBackdrop,
      backdropFilter: vibeControlTheme.effects.backdropFilter,
      zIndex: vibeControlTheme.zIndex.backdrop,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },

    overlay: {
      backgroundColor: vibeControlTheme.colors.overlayBg,
      color: vibeControlTheme.colors.overlayText,
      border: `1px solid ${vibeControlTheme.colors.overlayBorder}`,
      borderRadius: vibeControlTheme.dimensions.overlayBorderRadius,
      padding: vibeControlTheme.dimensions.overlayPadding,
      maxWidth: vibeControlTheme.dimensions.overlayMaxWidth,
      maxHeight: vibeControlTheme.dimensions.overlayMaxHeight,
      width: '90%',
      boxShadow: vibeControlTheme.effects.overlayShadow,
      position: 'relative' as const,
      overflow: 'auto' as const,
    },

    overlayTitle: {
      fontSize: vibeControlTheme.typography.overlayTitleFontSize,
      fontWeight: vibeControlTheme.typography.overlayTitleFontWeight,
      lineHeight: vibeControlTheme.typography.overlayTitleLineHeight,
      margin: '0 0 16px 0',
      paddingRight: '40px', // Space for close button
    },

    closeButton: {
      position: 'absolute' as const,
      top: vibeControlTheme.dimensions.overlayPadding,
      right: vibeControlTheme.dimensions.overlayPadding,
      width: vibeControlTheme.dimensions.closeButtonSize,
      height: vibeControlTheme.dimensions.closeButtonSize,
      backgroundColor: vibeControlTheme.colors.closeButtonBg,
      color: vibeControlTheme.colors.closeButtonText,
      border: 'none',
      borderRadius: vibeControlTheme.dimensions.closeButtonBorderRadius,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '18px',
      fontWeight: 'bold',
      transition: `background-color ${vibeControlTheme.effects.transition}`,
    },

    closeButtonHover: {
      backgroundColor: vibeControlTheme.colors.closeButtonBgHover,
    },

    content: {
      fontSize: vibeControlTheme.typography.overlayBodyFontSize,
      lineHeight: vibeControlTheme.typography.overlayBodyLineHeight,
    },
  };
};

// Default classes structure similar to ImgGen
export const defaultVibeControlClasses = {
  button: '',
  backdrop: '',
  overlay: '',
  overlayTitle: '',
  closeButton: '',
  content: '',
};

export type VibeControlClasses = typeof defaultVibeControlClasses;
