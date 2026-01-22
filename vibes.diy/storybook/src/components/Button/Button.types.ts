import type { ButtonIconConfig } from './Button.tokens';

export interface ButtonProps {
  children: React.ReactNode;
  variantId?: string;
  icon?: ButtonIconConfig;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  showEditButton?: boolean;
  onVariantChange?: (variantId: string) => void;
  onIconChange?: (icon: ButtonIconConfig) => void;
}

export type { ButtonVariantConfig, ButtonStateConfig, ButtonState, ButtonIconConfig, IconPosition } from './Button.tokens';
