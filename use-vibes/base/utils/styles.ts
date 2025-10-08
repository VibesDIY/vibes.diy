/**
 * ImgGen Component Styling Constants
 * Extracted from ImgGen.css to enable inline styling and eliminate CSS dependencies
 */

// CSS Custom Properties (Variables) as JavaScript constants
export const imgGenTheme = {
  // Colors with dark mode support using light-dark() CSS function
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

    // Form-specific theme-aware colors
    inputBorder: 'light-dark(#ccc, #555)',
    inputBg: 'light-dark(#ffffff, #2a2a2a)',
    inputText: 'light-dark(#333, #e0e0e0)',
    dropZoneBorder: 'light-dark(#ccc, #555)',
    dropZoneBg: 'light-dark(#fafafa, #2a2a2a)',
    dropZoneActiveBg: 'light-dark(#f0f8ff, #1a3a4a)',
    mutedText: 'light-dark(#666, #aaa)',
    lightBg: 'light-dark(#f0f0f0, #404040)',
    thumbnailBorder: 'light-dark(#ddd, #555)',
    titleText: 'light-dark(#333, #e0e0e0)',
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
    WebkitBackdropFilter: `blur(${imgGenTheme.effects.blurRadius})`, // Safari support
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

  // Prompt input for editing (now using theme-aware version below)

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
    aspectRatio: '1 / 1',
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

  // Upload waiting container
  uploadWaiting: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '1rem',
    padding: '1rem',
    alignItems: 'center' as const,
    textAlign: 'center' as const,
    backgroundColor: imgGenTheme.colors.inputBg,
    borderRadius: imgGenTheme.dimensions.borderRadius,
    border: `1px solid ${imgGenTheme.colors.inputBorder}`,
  },

  // Prompt form layout
  promptForm: {
    display: 'flex' as const,
    gap: '0.5rem',
    width: '100%',
    maxWidth: '600px',
    flexDirection: 'column' as const,
  },

  // Prompt input styling
  promptInput: {
    width: '100%',
    padding: '0.8rem',
    fontSize: '1rem',
    border: `1px solid ${imgGenTheme.colors.inputBorder}`,
    borderRadius: '4px',
    boxSizing: 'border-box' as const,
    backgroundColor: imgGenTheme.colors.inputBg,
    color: imgGenTheme.colors.inputText,
  },

  // Prompt submit button
  promptSubmit: {
    padding: '0.8rem',
    fontSize: '1rem',
    backgroundColor: imgGenTheme.colors.accent,
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer' as const,
    transition: 'background-color 0.3s',
  },

  // File drop zone base styling
  fileDrop: {
    border: `2px dashed ${imgGenTheme.colors.dropZoneBorder}`,
    borderRadius: '8px',
    padding: '2rem',
    textAlign: 'center' as const,
    cursor: 'pointer' as const,
    transition: 'border-color 0.3s, background-color 0.3s',
    backgroundColor: imgGenTheme.colors.dropZoneBg,
    marginTop: '1rem',
  },

  // File drop active state (when dragging over)
  fileDropActive: {
    borderColor: imgGenTheme.colors.accent,
    backgroundColor: imgGenTheme.colors.dropZoneActiveBg,
  },

  // File drop disabled state
  fileDropDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed' as const,
  },

  // File drop message text
  fileDropMessage: {
    color: imgGenTheme.colors.mutedText,
    fontSize: '1rem',
    fontWeight: 'normal' as const,
  },

  // Uploaded previews container
  uploadedPreviews: {
    width: '100%',
    marginTop: '1rem',
  },

  // Upload count display
  uploadCount: {
    fontSize: '0.9rem',
    color: imgGenTheme.colors.mutedText,
    marginBottom: '0.5rem',
    fontWeight: 'bold' as const,
  },

  // Thumbnails grid
  thumbnails: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
    gap: '0.5rem',
    maxWidth: '400px',
    margin: '0 auto',
  },

  // Individual thumbnail
  thumbnail: {
    aspectRatio: '1 / 1',
    overflow: 'hidden' as const,
    borderRadius: '4px',
    border: `1px solid ${imgGenTheme.colors.thumbnailBorder}`,
  },

  // Thumbnail image
  thumbnailImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },

  // More count indicator
  moreCount: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: imgGenTheme.colors.lightBg,
    color: imgGenTheme.colors.mutedText,
    fontSize: '0.8rem',
    fontWeight: 'bold' as const,
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
  baseStyle: Record<string, unknown>,
  variants: Record<string, unknown> = {}
): Record<string, unknown> {
  return { ...baseStyle, ...variants };
}

// Utility functions for common style patterns
export const styleUtils = {
  // Create hover state styles (for use with CSS-in-JS)
  hover: (styles: Record<string, unknown>) => ({
    '&:hover': styles,
  }),

  // Create disabled state styles
  disabled: (styles: Record<string, unknown>) => ({
    '&:disabled': styles,
  }),

  // Create media query styles
  mediaQuery: (query: string, styles: Record<string, unknown>) => ({
    [`@media ${query}`]: styles,
  }),

  // Common transitions
  transition: (properties: string[], duration: string = imgGenTheme.effects.transitionSpeed) => ({
    transition: properties.map((prop) => `${prop} ${duration} ease`).join(', '),
  }),
};
