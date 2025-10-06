import React, { useRef, useState, useEffect } from 'react';

interface HiddenMenuWrapperProps {
  children: React.ReactNode;
  menuContent: React.ReactNode;
}

export default function HiddenMenuWrapper({ children, menuContent }: HiddenMenuWrapperProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuHeight, setMenuHeight] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menuRef.current) {
      setMenuHeight(menuRef.current.offsetHeight);
    }
  }, [menuContent]);

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
  };

  const menuStyle: React.CSSProperties = {
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
  };

  const contentStyle: React.CSSProperties = {
    filter: menuOpen ? 'blur(4px)' : 'none',
    width: '100%',
    height: '100%',
  };

  const contentStyleWrapper: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    transition: 'transform 0.5s ease, filter 0.3s ease',
    transform: menuOpen ? `translateY(-${menuHeight}px)` : 'translateY(0)',
    overflowY: 'auto',
    backgroundColor: '#242424',
  };

  const buttonStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 16,
    right: 16,
    zIndex: 20,
    backgroundColor: '#2563eb',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: '9999px',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  };

  return (
    <div style={wrapperStyle}>
      {/* Menu */}
      <div ref={menuRef} style={menuStyle}>
        {menuContent}
      </div>

      {/* Content */}
      <div style={contentStyleWrapper}>
        <div style={contentStyle}>
          {children}
        </div>
      </div>

      {/* Button */}
      <button onClick={() => setMenuOpen(!menuOpen)} style={buttonStyle}>
        {menuOpen ? 'Close' : 'Open'}
      </button>
    </div>
  );
}
