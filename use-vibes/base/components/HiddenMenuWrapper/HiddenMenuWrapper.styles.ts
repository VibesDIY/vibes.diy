/**
 * HiddenMenuWrapper Component Styling
 * Following the same pattern as VibeControl styles for consistency
 *
 * Dark mode support:
 * Override CSS variables in your stylesheet using:
 *
 * @media (prefers-color-scheme: dark) {
 *   :root {
 *     --hm-menu-bg: #2a2a2a;
 *     --hm-menu-text: #e0e0e0;
 *     --hm-content-bg: #1a1a1a;
 *     --hm-shadow: rgba(255, 255, 255, 0.1);
 *   }
 * }
 */

// CSS Custom Properties (Variables) as JavaScript constants with fallbacks
export const hiddenMenuTheme = {
  colors: {
    menuBg: 'var(--hm-menu-bg, #d4d4d4)',
    menuText: 'var(--hm-menu-text, white)',
    contentBg: 'var(--hm-content-bg, #1e1e1e)',
    shadow: 'var(--hm-shadow, rgba(0, 0, 0, 0.3))',
    gridLineColor: 'var(--hm-grid-line, rgba(255, 255, 255, 0.5))',
  },

  zIndex: {
    menu: 5,
    content: 10,
    toggle: 20,
  },

  dimensions: {
    gridSize: '40px',
    padding: '24px',
    bottomOffset: '16px',
  },

  animation: {
    duration: '0.4s',
    easing: 'ease',
    blurAmount: '4px',
  },
};

export const getWrapperStyle = (): React.CSSProperties => ({
  position: 'relative',
  overflow: 'hidden',
});

export const getMenuStyle = (): React.CSSProperties => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: hiddenMenuTheme.zIndex.menu,
  color: hiddenMenuTheme.colors.menuText,
  padding: hiddenMenuTheme.dimensions.padding,
  boxShadow: `0 -2px 10px ${hiddenMenuTheme.colors.shadow}`,
  backgroundColor: hiddenMenuTheme.colors.menuBg,
  backgroundImage: `
    linear-gradient(${hiddenMenuTheme.colors.gridLineColor} 1px, transparent 1px),
    linear-gradient(90deg, ${hiddenMenuTheme.colors.gridLineColor} 1px, transparent 1px)
  `,
  backgroundSize: hiddenMenuTheme.dimensions.gridSize + ' ' + hiddenMenuTheme.dimensions.gridSize,
});

export const getContentStyle = (): React.CSSProperties => ({
  filter: 'none',
  width: '100%',
  height: '100%',
});

export const getContentWrapperStyle = (
  menuHeight: number,
  menuOpen: boolean
): React.CSSProperties => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: hiddenMenuTheme.zIndex.content,
  transition: `transform ${hiddenMenuTheme.animation.duration} ${hiddenMenuTheme.animation.easing}, filter 0.3s ${hiddenMenuTheme.animation.easing}`,
  transform: menuOpen ? `translateY(-${menuHeight}px)` : 'translateY(0)',
  overflowY: 'auto',
  backgroundColor: hiddenMenuTheme.colors.contentBg,
  filter: menuOpen ? `blur(${hiddenMenuTheme.animation.blurAmount})` : 'none',
});

export const getToggleButtonStyle = (): React.CSSProperties => ({
  position: 'fixed',
  bottom: hiddenMenuTheme.dimensions.bottomOffset,
  right: 0,
  zIndex: hiddenMenuTheme.zIndex.toggle,
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
});
