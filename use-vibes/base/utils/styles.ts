/**
 * ImgGen Component Styling Constants
 * Extracted from ImgGen.css to enable inline styling and eliminate CSS dependencies
 */

// CSS Custom Properties (Variables) as JavaScript constants
export const imgGenTheme = {
  // Colors
  colors: {
    text: '#333',
    background: '#333333',
    overlayBg: 'rgba(255, 255, 255, 0.5)',
    accent: '#0066cc',
    flash: '#fe0',
    errorBg: 'rgba(0, 0, 0, 0.7)',
    errorBorder: '#ff6666',
    errorText: '#ff6666',
    errorTextBody: '#ffffff',
    buttonBg: 'rgba(255, 255, 255, 0.7)',
    deleteHover: '#ff3333',
  },

  // Dimensions
  dimensions: {
    borderRadius: '8px',
    padding: '8px',
    buttonSize: '28px',
    progressHeight: '8px',
  },

  // Typography
  typography: {
    fontSize: '14px',
    fontWeight: 'bold',
    lineHeight: '1.5',
  },

  // Effects
  effects: {
    blurRadius: '4px',
    transitionSpeed: '0.2s',
    shadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  },
} as const;

// Base style objects for core components
export const imgGenStyles = {
  // Root container
  root: {
    position: 'relative' as const,
    maxWidth: '100%',
    overflow: 'hidden' as const,
  },

  // Image container
  container: {
    position: 'relative' as const,
    width: '100%',
    height: '100%',
  },

  // Image container with expand button
  imageContainer: {
    position: 'relative' as const,
    width: '100%',
    overflow: 'hidden' as const,
  },

  // The image itself
  image: {
    width: '100%',
    height: 'auto' as const,
    display: 'block' as const,
  },

  // Base overlay that appears at the bottom
  overlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: imgGenTheme.dimensions.padding,
    backgroundColor: imgGenTheme.colors.overlayBg,
    backdropFilter: `blur(${imgGenTheme.effects.blurRadius})`,
    transition: `opacity ${imgGenTheme.effects.transitionSpeed} ease`,
    zIndex: 10,
    display: 'flex' as const,
    flexDirection: 'column' as const,
  },

  // Top line row with prompt and version indicator
  topLine: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    width: '100%',
  },

  // Prompt text container
  prompt: {
    width: '100%',
    padding: '4px',
    marginBottom: '8px',
  },

  // Prompt text styling
  promptText: {
    color: imgGenTheme.colors.text,
    width: '100%',
    textAlign: 'center' as const,
    fontWeight: imgGenTheme.typography.fontWeight,
    padding: '2px',
    cursor: 'pointer' as const,
  },

  // Prompt input for editing
  promptInput: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: imgGenTheme.typography.fontSize,
    fontWeight: imgGenTheme.typography.fontWeight,
    color: imgGenTheme.colors.text,
    backgroundColor: 'white',
  },

  // Controls row
  controls: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    width: '100%',
    paddingTop: '2px',
  },

  // Control button group
  controlGroup: {
    display: 'flex' as const,
    gap: '6px',
    alignItems: 'center' as const,
  },

  // Base button styling
  button: {
    background: imgGenTheme.colors.buttonBg,
    borderRadius: '50%',
    width: imgGenTheme.dimensions.buttonSize,
    height: imgGenTheme.dimensions.buttonSize,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    border: 'none',
    cursor: 'pointer' as const,
    opacity: 0.5,
    transition: `opacity ${imgGenTheme.effects.transitionSpeed} ease`,
    padding: 0,
    fontSize: imgGenTheme.typography.fontSize,
    color: imgGenTheme.colors.text,
  },

  // Progress bar container
  progressContainer: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },

  // Actual progress bar
  progress: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    height: imgGenTheme.dimensions.progressHeight,
    backgroundColor: imgGenTheme.colors.accent,
    transition: 'width 0.3s ease-in-out',
    zIndex: 11,
  },

  // Placeholder styling
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: imgGenTheme.colors.background,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    boxSizing: 'border-box' as const,
  },

  // Status text (e.g. Generating...)
  statusText: {
    width: '100%',
    textAlign: 'center' as const,
    fontSize: imgGenTheme.typography.fontSize,
    color: imgGenTheme.colors.text,
    opacity: 0.7,
    padding: '8px 0',
  },

  // Error container wrapper
  errorContainer: {
    backgroundColor: '#222',
    aspectRatio: '1 / 1',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: '1rem',
    width: '100%',
    borderRadius: imgGenTheme.dimensions.borderRadius,
    overflow: 'hidden' as const,
  },

  // Error container
  error: {
    backgroundColor: '#000',
    color: imgGenTheme.colors.errorText,
    padding: '1.5rem',
    borderRadius: imgGenTheme.dimensions.borderRadius,
    border: `1px solid ${imgGenTheme.colors.errorBorder}`,
    boxShadow: imgGenTheme.effects.shadow,
    maxWidth: '80%',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    textAlign: 'center' as const,
  },

  // Error title
  errorTitle: {
    color: imgGenTheme.colors.errorText,
    marginTop: 0,
    fontWeight: 'bold',
    fontSize: '18px',
    marginBottom: '12px',
    textAlign: 'center' as const,
  },

  // Error message
  errorMessage: {
    whiteSpace: 'pre-wrap' as const,
    color: imgGenTheme.colors.errorTextBody,
    fontSize: imgGenTheme.typography.fontSize,
    lineHeight: imgGenTheme.typography.lineHeight,
    textAlign: 'left' as const,
    fontFamily: 'monospace, sans-serif',
    marginBottom: 0,
  },

  // Prompt input edit mode
  promptInputEditMode: {
    border: `2px solid ${imgGenTheme.colors.accent}`,
    padding: '6px 10px',
    borderRadius: '6px',
  },

  // Helper classes
  truncate: {
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
  },
} as const;

// Helper function to merge styles with theme variants
export function createStyledVariant(
  baseStyle: Record<string, any>,
  variants: Record<string, any> = {}
): Record<string, any> {
  return { ...baseStyle, ...variants };
}

// Utility functions for common style patterns
export const styleUtils = {
  // Create hover state styles (for use with CSS-in-JS)
  hover: (styles: Record<string, any>) => ({
    '&:hover': styles,
  }),

  // Create disabled state styles
  disabled: (styles: Record<string, any>) => ({
    '&:disabled': styles,
  }),

  // Create media query styles
  mediaQuery: (query: string, styles: Record<string, any>) => ({
    [`@media ${query}`]: styles,
  }),

  // Common transitions
  transition: (properties: string[], duration: string = imgGenTheme.effects.transitionSpeed) => ({
    transition: properties.map((prop) => `${prop} ${duration} ease`).join(', '),
  }),
};
