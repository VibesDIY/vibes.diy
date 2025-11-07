import { CSSProperties } from 'react';

// Theme matching HiddenMenuWrapper
export const authWallTheme = {
  colors: {
    menuBg: 'var(--aw-menu-bg, #d4d4d4)',
    shadow: 'var(--aw-shadow, rgba(0, 0, 0, 0.3))',
    gridLineColor: 'var(--aw-grid-line, rgba(255, 255, 255, 0.5))',
  },

  dimensions: {
    gridSize: '40px',
    padding: '24px',
  },

  animation: {
    duration: '0.4s',
    easing: 'ease',
    blurAmount: '4px',
  },
};

// Main wrapper
export const getWrapperStyle = (): CSSProperties => ({
  position: 'relative',
  overflow: 'hidden',
});

// Menu section at bottom (like HiddenMenuWrapper menu) - always there
export const getMenuStyle = (): CSSProperties => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 1000,
  backgroundColor: authWallTheme.colors.menuBg,
  backgroundImage: `
    linear-gradient(${authWallTheme.colors.gridLineColor} 1px, transparent 1px),
    linear-gradient(90deg, ${authWallTheme.colors.gridLineColor} 1px, transparent 1px)
  `,
  backgroundSize: authWallTheme.dimensions.gridSize + ' ' + authWallTheme.dimensions.gridSize,
  boxShadow: `0 -2px 10px ${authWallTheme.colors.shadow}`,
  padding: authWallTheme.dimensions.padding,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '80vh',
});

// Image content wrapper (like HiddenMenuWrapper content wrapper) - slides up to reveal menu
export const getImageContentWrapperStyle = (): CSSProperties => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 1100,
  overflowY: 'auto',
});

// Image section - full screen inside content wrapper
export const getImageSectionStyle = (imageUrl: string): CSSProperties => ({
  width: '100%',
  height: '100%',
  backgroundImage: `url(${imageUrl})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const getOverlayStyle = (): CSSProperties => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backdropFilter: 'blur(12px)',
  backgroundColor: 'rgba(255, 255, 255, 0.4)',
});

export const getFormContainerStyle = (): CSSProperties => ({
  position: 'relative',
  background: '#ffffff',
  border: '3px solid #1a1a1a',
  borderRadius: '12px',
  padding: '2rem 3rem',
  textAlign: 'left',
  maxWidth: '400px',
  width: '90%',
  boxShadow: '6px 6px 0px #1a1a1a',
});

export const getTitleStyle = (): CSSProperties => ({
  fontSize: '1.3rem',
  fontWeight: 800,
  marginBottom: '0px',
  color: '#1a1a1a',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

export const getDescriptionStyle = (): CSSProperties => ({
  fontSize: '1rem',
  marginBottom: '2rem',
  marginTop: '8px',
  color: '#333333',
});
