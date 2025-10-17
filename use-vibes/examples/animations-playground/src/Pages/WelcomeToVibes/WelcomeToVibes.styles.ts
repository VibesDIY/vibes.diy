import type { CSSProperties } from 'react';

export const getContainerStyle = (): CSSProperties => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: 'calc(100% - 48px)',
  height: 'calc(100% - 48px)',
  flexDirection: 'column',
  gap: '24px',
});
