import { CSSProperties } from "react";

export const HomeScreenTheme = {
    colors: {
        menuBg: 'var(--hm-menu-bg, #d4d4d4)',
        menuText: 'var(--hm-menu-text, white)',
        contentBg: 'var(--hm-content-bg, #1e1e1e)',
        shadow: 'var(--hm-shadow, rgba(0, 0, 0, 0.3))',
        gridLineColor: 'var(--hm-grid-line, rgba(255, 255, 255, 0.5))',
    },
    dimensions: {
        padding: '20px',
        gridSize: '40px',
    },
    animation: {
        duration: '0.4s',
        easing: 'ease',
        blurAmount: '4px',
    },
    fonts: {
        primary: "'Alte Haas Grotesk', 'Inter', sans-serif",
    },
};

// Wrapper with padding (full screen height)
export const getWrapperStyle = (): CSSProperties => ({
    backgroundColor: HomeScreenTheme.colors.menuBg,
    width: '100%',
    minHeight: '100vh',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: HomeScreenTheme.fonts.primary,
});

// Sticky menu line
export const getMenuStyle = (): CSSProperties => ({
    position: 'sticky',
    top: 0,
    left: 0,
    right: 0,
    height: '64px',
    backgroundColor: 'white',
    color: HomeScreenTheme.colors.menuText,
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    zIndex: 100,
    borderBottom: '1px solid black',
    fontFamily: HomeScreenTheme.fonts.primary,
});

// Container with background grid (overlaid by menu, full screen height)
export const getContainerStyle = (): CSSProperties => ({
    flex: 1,
    width: '100%',
    minHeight: 'calc(100vh - 90px)', // viewport - padding - menu
    border: '1px solid white',
    color: HomeScreenTheme.colors.menuText,
    backgroundColor: HomeScreenTheme.colors.menuBg,
    backgroundSize: `${HomeScreenTheme.dimensions.gridSize} ${HomeScreenTheme.dimensions.gridSize}`,
    backgroundImage: `
      linear-gradient(${HomeScreenTheme.colors.gridLineColor} 1px, transparent 1px),
      linear-gradient(90deg, ${HomeScreenTheme.colors.gridLineColor} 1px, transparent 1px)
    `,
    position: 'relative',
    overflow: 'hidden',
    fontFamily: HomeScreenTheme.fonts.primary,
});

// Inner container for cards and content
export const getInnerContainerStyle = (isMobile: boolean): CSSProperties => ({
    width: '100%',
    height: '100%',
    position: 'relative',
    padding: isMobile ? '20px' : '0px',
    fontFamily: HomeScreenTheme.fonts.primary,
});

export const getSectionsContainerStyle = (isMobile: boolean): CSSProperties => ({
    width: '100%',
    height: '100%',
    fontFamily: HomeScreenTheme.fonts.primary,
    paddingTop: isMobile ? '0px' : 'calc(100vh + 100px)',
});

export const getSecondCardStyle = (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
});
