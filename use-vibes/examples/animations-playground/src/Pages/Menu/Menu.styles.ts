// MenuStyles.ts
import type { CSSProperties } from 'react';

export const getContainerStyle = (): CSSProperties => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#2C3940',
  color: 'white',
  fontFamily: "'Fira Sans', sans-serif",
  overflow: 'hidden',
  textAlign: 'center',
  position: 'relative',
  zIndex: 10,
});

export const getMenuListStyle = (): CSSProperties => ({
  listStyle: 'none',
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
});

export const getTitleStyle = (): CSSProperties => ({
  fontSize: '4rem',
  color: 'white',
  marginBottom: '1rem',
  textShadow: '3px 3px 6px rgba(0, 0, 0, 0.3)',
  animation: 'fadeInDown 1s ease-out',
});

export const getButtonInnerStyle = (): CSSProperties => ({
  position: 'relative',
  width: '200px',
  height: '200px',
  borderRadius: '2px',
  boxShadow: '0px 0px 0px 0px rgba(0, 0, 0, 0.04)',
  fontWeight: 100,
  fontSize: '12px',
  cursor: 'pointer',
  border: '2px solid #FFFFFF',
  color: 'white',
  textAlign: 'center',
  transition: 'all 0.3s, box-shadow 0.2s, transform 0.2s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  textDecoration: 'none',
  overflow: 'visible',
  zIndex: 2,
});

export const getButtonTextStyle = (): CSSProperties => ({
  position: 'relative',
  fontSize: '14px',
  transition: 'opacity 0.3s',
  zIndex: 3,
});
