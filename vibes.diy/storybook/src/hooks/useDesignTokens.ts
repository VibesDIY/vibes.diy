import { useAppSelector } from '../store/hooks';

export const useDesignTokens = () => {
  const colorTokens = useAppSelector(state => state.designTokens.colorTokens);
  const typographyTokens = useAppSelector(state => state.designTokens.typographyTokens);
  const defaultFontFamily = useAppSelector(state => state.designTokens.defaultFontFamily);

  return {
    colorTokens,
    typographyTokens,
    defaultFontFamily,
  };
};
