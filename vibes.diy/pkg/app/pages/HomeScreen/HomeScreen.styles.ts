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

// Fixed background layer (stays in place while content scrolls)
export const getBackgroundStyle = (): CSSProperties => ({
    position: 'fixed',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: '10px',
    backgroundColor: HomeScreenTheme.colors.menuBg,
    zIndex: 0, // Below everything
    fontFamily: HomeScreenTheme.fonts.primary,
});

// Fixed noise texture overlay (stays in place while content scrolls)
export const getNoiseTextureStyle = (): CSSProperties => ({
    position: 'fixed',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: '10px',
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='3.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
    filter: 'contrast(200%) brightness(100%)',
    mixBlendMode: 'overlay',
    opacity: 0.9, // Reduced opacity so it shows through color gradients
    pointerEvents: 'none',
    zIndex: 2, // Above color gradients but below grid
    fontFamily: HomeScreenTheme.fonts.primary,
});

// Scrolling color backgrounds container (scrolls with content, below fixed grid)
export const getScrollingBackgroundsStyle = (): CSSProperties => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    minHeight: '100%',
    zIndex: 1, // Above base background, below grid
    pointerEvents: 'none',
});

// Fixed grid overlay (stays in place while content scrolls over it)
export const getWrapperStyle = (): CSSProperties => ({
    position: 'fixed',
        top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: '10px',
    pointerEvents: 'none', // Allow clicks to pass through to content below
    zIndex: 2, // On top of background, below content
    backgroundSize: `${HomeScreenTheme.dimensions.gridSize} ${HomeScreenTheme.dimensions.gridSize}`,
    backgroundImage: `
      linear-gradient(${HomeScreenTheme.colors.gridLineColor} 1px, transparent 1px),
      linear-gradient(90deg, ${HomeScreenTheme.colors.gridLineColor} 1px, transparent 1px)
    `,
    fontFamily: HomeScreenTheme.fonts.primary,
});

// Sticky menu line (stays at top within the inner wrapper)
export const getMenuStyle = (): CSSProperties => ({
    position: 'sticky',
    top: 0,
    left: 0,
    right: 0,
    height: '64px',
    backgroundColor: '#fefff2',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    zIndex: 1000, // Very high z-index to stay on top of everything
    borderBottom: '1px solid black',
    fontFamily: HomeScreenTheme.fonts.primary,
    borderTopLeftRadius: '10px',
    borderTopRightRadius: '10px',
    boxShadow: '0px 1px 0px 0px #fefff2',
});

// Scrollable container for content (needs high z-index so children can be above grid)
export const getContainerStyle = (): CSSProperties => ({
    width: '100%',
    minHeight: '100vh',
    color: HomeScreenTheme.colors.menuText,
    position: 'relative',
    overflow: 'visible',
    fontFamily: HomeScreenTheme.fonts.primary,
    backgroundColor: 'transparent', // Transparent so grid shows through
    zIndex: 3, // Above the grid (grid is z-index: 2) so children can be above grid too
});

// Inner container for cards and content
export const getInnerContainerStyle = (isMobile: boolean): CSSProperties => ({
    width: '100%',
    minHeight: '100vh',
    position: 'relative',
    padding: isMobile ? '20px' : '0px',
    fontFamily: HomeScreenTheme.fonts.primary,
});

export const getSectionsContainerStyle = (isMobile: boolean): CSSProperties => ({
    width: '100%',
    minHeight: '100vh',
    fontFamily: HomeScreenTheme.fonts.primary,
    paddingTop: '0px' ,
    position: 'relative',
    gap: isMobile ? '300px' : '30px',
    display: 'flex',
    flexDirection: 'column',
    marginTop: isMobile ? '400px' : '0px',
});

export const getSecondCardStyle = (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
});

// Section wrapper with colored background
export const getSectionWrapperStyle = (isMobile: boolean): CSSProperties => ({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: isMobile ? '0px 20px' : '200px 0px',
    overflow: 'hidden',
});

// First section color background (in scrolling backgrounds container)
export const getFirstSectionColorBackgroundStyle = (isMobile: boolean): CSSProperties => ({
    position: 'absolute',
    top: isMobile ? 'calc(200vh + 64px)' : 'calc(110vh + 64px - 85px)', // Start at first section (accounting for menu)
    left: 0,
    right: 0,
    height: isMobile ? 'calc(180vh)' : 'calc(100vh + 460px)', // Cover first section and transition
    pointerEvents: 'none',
    background: `
        linear-gradient(
            180deg,
            transparent 0%,
            #009ace 30%,
            #009ace 60%,
            #b55f4d 100%
        )
    `,
});

// Second section color background (in scrolling backgrounds container)
export const getSecondSectionColorBackgroundStyle = (isMobile: boolean): CSSProperties => ({
    position: 'absolute',
    top: isMobile ? 'calc(380vh + 64px)' : 'calc(210vh + 64px + 370px)', // Start where first section gradient ends (accounting for menu)
    left: 0,
    right: 0,
    height: '110vh', // Large enough to cover second section and beyond
    pointerEvents: 'none',
    background: `
        linear-gradient(
            180deg,
            #b55f4d 0%,
            #da291cd5 20%,
            #da291cd5 100%
        )
    `,
});

// Content card (white background)
export const getSectionContentStyle = (): CSSProperties => ({
    position: 'relative',
    width: '80%',
    padding: '40px',
    borderRadius: '15px',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    color: '#000000',
    zIndex: 10, // Above grid and colored backgrounds
});

export const getBlackBorderInnerWrapper = (): CSSProperties => ({
    height: 'calc(100% - 20px)',
    width: 'calc(100% - 20px)',
    margin: '10px',
    borderRadius: '10px',
    position: 'relative',
    overflow: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
});

export const getBlackBorderWrapper = (): CSSProperties => ({
    width: '100%',
    height: '100%',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
});
