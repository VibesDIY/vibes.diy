import type { CSSProperties } from 'react';

export const getWrapperStyle = (imageUrl: string): CSSProperties => ({
  position: 'fixed',
  top: 0,
  width: '100%',
  height: '100vh',
  backgroundImage: `url(${imageUrl})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
});

export const getOverlayStyle = (): CSSProperties => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backdropFilter: 'blur(12px)',
  backgroundColor: 'rgba(255, 255, 255, 0.4)',
  zIndex: 1,
});

export const getFormContainerStyle = (): CSSProperties => ({
  position: 'relative',
  zIndex: 2,
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
