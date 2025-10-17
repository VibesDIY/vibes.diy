import { CSSProperties } from 'react';
export const switchColors: {
  primary: string;
  secondary: string;
} = {
  primary: '#000000',
  secondary: '#FFFFFF',
};

export const getVibesSvgStyle = (entered: boolean): CSSProperties => ({
  transform: entered ? 'scale(1)' : 'scale(0)',
  opacity: entered ? 1 : 0,
  transition: 'transform 0.6s ease-out, opacity 0.6s ease-out',
});

export const getVibesContentStyle = (show: boolean, delay = '0s'): CSSProperties => ({
  opacity: show ? 1 : 0,
  transition: `opacity 0.5s ease ${delay}`,
});
