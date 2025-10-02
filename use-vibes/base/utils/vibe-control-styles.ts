/**
 * VibeControl Component Styling Constants
 * Following the same pattern as ImgGen styles for consistency
 */

// CSS Custom Properties (Variables) as JavaScript constants
export const vibeControlTheme = {
  // Colors with dark mode support using light-dark() CSS function
  colors: {
    buttonBg: 'light-dark(#0066cc, #4a90e2)',
    buttonBgHover: 'light-dark(#0052a3, #357abd)',
    buttonText: '#ffffff',
    buttonBorder: 'light-dark(#0066cc, #4a90e2)',

    overlayBackdrop: 'rgba(0, 0, 0, 0.5)',
    overlayBg: 'light-dark(#ffffff, #1a1a1a)',
    overlayText: 'light-dark(#333333, #e0e0e0)',
    overlayBorder: 'light-dark(#e0e0e0, #404040)',

    closeButtonBg: 'light-dark(#f5f5f5, #2a2a2a)',
    closeButtonBgHover: 'light-dark(#e0e0e0, #404040)',
    closeButtonText: 'light-dark(#666666, #cccccc)',

    accent: '#0066cc',
    shadow: 'rgba(0, 0, 0, 0.15)',
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
export const createVibeControlStyles = () => ({
  button: {
    position: 'fixed' as const,
    bottom: vibeControlTheme.dimensions.buttonPosition,
    right: vibeControlTheme.dimensions.buttonPosition,
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
    transition: `all ${vibeControlTheme.effects.transition}`,
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
    transition: `all ${vibeControlTheme.effects.transition}`,
  },

  closeButtonHover: {
    backgroundColor: vibeControlTheme.colors.closeButtonBgHover,
  },

  content: {
    fontSize: vibeControlTheme.typography.overlayBodyFontSize,
    lineHeight: vibeControlTheme.typography.overlayBodyLineHeight,
  },
});

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
