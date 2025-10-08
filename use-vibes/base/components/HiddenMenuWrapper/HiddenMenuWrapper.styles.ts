export const getWrapperStyle = (): React.CSSProperties => ({
    position: 'relative',
    overflow: 'hidden',
});

export const getMenuStyle = (): React.CSSProperties => ({
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    color: 'white',
    padding: '24px',
    boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.3)',
    backgroundColor: '#d4d4d4',
    backgroundImage: `
    linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px)
  `,
    backgroundSize: '40px 40px',
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
    zIndex: 10,
    transition: 'transform 0.4s ease, filter 0.3s ease',
    transform: menuOpen ? `translateY(-${menuHeight}px)` : 'translateY(0)',
    overflowY: 'auto',
    backgroundColor: '#1e1e1e',
    filter: menuOpen ? 'blur(4px)' : 'none',
});

export const getToggleButtonStyle = (): React.CSSProperties => ({
    position: 'fixed',
    bottom: 16,
    right: 0,
    zIndex: 20,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
});
