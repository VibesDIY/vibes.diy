import { CSSProperties } from 'react';

export const getContainerStyle = (customStyle?: CSSProperties): CSSProperties => ({
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '12px',
  ...customStyle,
});

export const innerContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '12px',
  width: '250px',
};

export const formStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

export const labelStyle: CSSProperties = {
  alignSelf: 'flex-start',
  fontWeight: 600,
};

export const inputCardStyle: CSSProperties = {
  width: '100%',
};

export const inputStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  fontSize: 'inherit',
  fontWeight: 'inherit',
  letterSpacing: 'inherit',
  padding: 0,
};

export const statusCardStyle: CSSProperties = {
  textAlign: 'center',
};
