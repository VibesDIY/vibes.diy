import { useEffect } from 'react';
import { useAppSelector } from '../store/hooks';
import type { ColorToken } from './TokensEditor/TokensEditor.types';

const updateCSSVariable = (variable: string, lightValue: string, darkValue: string) => {
  if (typeof document === 'undefined') return;

  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

  document.documentElement.style.setProperty(`${variable}-light`, lightValue);
  document.documentElement.style.setProperty(`${variable}-dark`, darkValue);

  const activeValue = isDarkMode ? darkValue : lightValue;
  document.documentElement.style.setProperty(variable, activeValue);
};

export const CSSVariablesSynchronizer = () => {
  const colorTokens = useAppSelector(state => state.designTokens.colorTokens);

  useEffect(() => {
    colorTokens.forEach((token: ColorToken) => {
      updateCSSVariable(token.variable, token.lightValue, token.darkValue);
    });
  }, [colorTokens]);

  return null;
};
