import React, { forwardRef, useState, useEffect } from 'react';
import type { ButtonVariantConfig, ButtonState, ButtonIconConfig } from './Button.tokens';
import { FONTAWESOME_ICONS } from './Button.tokens';
import type {
  TypographyToken,
  SpacingToken,
  RadiusToken,
  ShadowToken,
  ShadowLayer,
  EffectToken,
  TextTransform,
} from '../TokensEditor/TokensEditor.types';
import { useAppSelector } from '../../store/hooks';

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

function renderButtonIcon(
  icon: ButtonIconConfig,
  sizePx: number,
  color: string
): React.ReactNode {
  if (icon.type === 'none') return null;

  if (icon.type === 'fontawesome' && icon.name && FONTAWESOME_ICONS[icon.name]) {
    return (
      <svg
        width={sizePx}
        height={sizePx}
        viewBox="0 0 512 512"
        fill={color}
        style={{ flexShrink: 0, transition: 'fill 0.2s ease' }}
        dangerouslySetInnerHTML={{ __html: FONTAWESOME_ICONS[icon.name] }}
      />
    );
  }

  if (icon.type === 'custom' && icon.customSvg) {
    return (
      <span
        style={{
          width: sizePx,
          height: sizePx,
          display: 'inline-flex',
          flexShrink: 0,
          color: color,
          transition: 'color 0.2s ease',
        }}
        dangerouslySetInnerHTML={{ __html: icon.customSvg }}
      />
    );
  }

  return null;
}

export interface ButtonUIProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant: ButtonVariantConfig;
  icon?: ButtonIconConfig;
  className?: string;
  forceState?: ButtonState;
}

function shadowLayersToCSS(layers: ShadowLayer[], colorOverride?: string): string {
  return layers.map((layer, index) => {
    const inset = layer.inset ? 'inset ' : '';
    // First layer uses the color override (the main shadow color), subsequent layers keep their original color (usually border)
    const color = (colorOverride && index === 0) ? colorOverride : layer.color;
    return `${inset}${layer.offsetX.value}${layer.offsetX.unit} ${layer.offsetY.value}${layer.offsetY.unit} ${layer.blur.value}${layer.blur.unit} ${layer.spread.value}${layer.spread.unit} ${color}`;
  }).join(', ');
}

function getTranslateY(
  spacingTokens: SpacingToken[],
  tokenVariable: string,
  direction: 'up' | 'down' | 'none'
): string {
  if (direction === 'none') return '0';
  const token = spacingTokens.find((t: SpacingToken) => t.variable === tokenVariable);
  if (!token) return '0';
  const value = `${token.value}${token.unit}`;
  return direction === 'up' ? `-${value}` : value;
}

function buildTransition(effectToken: EffectToken | null): string {
  if (!effectToken) return 'all 0.2s ease';
  if (effectToken.type === 'transition' || effectToken.type === 'animation') {
    const property = effectToken.transitionProperty || 'all';
    const duration = effectToken.transitionDuration?.value || 200;
    const timing = effectToken.transitionTimingFunction || 'ease';
    const delay = effectToken.transitionDelay?.value || 0;
    return `${property} ${duration}ms ${timing}${delay > 0 ? ` ${delay}ms` : ''}`;
  }
  return 'all 0.2s ease';
}

export function generateButtonStyles(
  variant: ButtonVariantConfig,
  currentState: ButtonState,
  typographyToken: TypographyToken | null,
  spacingTokens: SpacingToken[],
  radiusTokens: RadiusToken[],
  shadowTokens: ShadowToken[],
  effectTokens: EffectToken[]
): React.CSSProperties {
  const stateConfig = variant.states[currentState];

  // Use variant's padding directly - no overrides
  const paddingYVar = variant.paddingY;
  const paddingXVar = variant.paddingX;

  const paddingYToken = spacingTokens.find((t: SpacingToken) => t.variable === paddingYVar);
  const paddingXToken = spacingTokens.find((t: SpacingToken) => t.variable === paddingXVar);
  const paddingY = paddingYToken ? `${paddingYToken.value}${paddingYToken.unit}` : '12px';
  const paddingX = paddingXToken ? `${paddingXToken.value}${paddingXToken.unit}` : '24px';

  const radiusToken = radiusTokens.find((t: RadiusToken) => t.variable === variant.borderRadius);
  let borderRadius = '8px';
  if (radiusToken) {
    if (radiusToken.isIndividual && radiusToken.topLeft && radiusToken.topRight && radiusToken.bottomRight && radiusToken.bottomLeft) {
      borderRadius = `${radiusToken.topLeft.value}${radiusToken.topLeft.unit} ${radiusToken.topRight.value}${radiusToken.topRight.unit} ${radiusToken.bottomRight.value}${radiusToken.bottomRight.unit} ${radiusToken.bottomLeft.value}${radiusToken.bottomLeft.unit}`;
    } else {
      borderRadius = `${radiusToken.value}${radiusToken.unit}`;
    }
  }

  const borderWidthToken = spacingTokens.find((t: SpacingToken) => t.variable === variant.borderWidth);
  const borderWidth = borderWidthToken ? `${borderWidthToken.value}${borderWidthToken.unit}` : '2px';

  const shadowToken = shadowTokens.find((t: ShadowToken) => t.variable === stateConfig.shadow);
  const shadowColorOverride = stateConfig.shadowColor;
  const shadowValue = stateConfig.shadow === 'none' ? 'none' : (shadowToken ? shadowLayersToCSS(shadowToken.layers, shadowColorOverride) : 'none');

  const effectToken = effectTokens.find((t: EffectToken) => t.variable === variant.effect) || null;
  const transition = buildTransition(effectToken);

  const translateY = getTranslateY(spacingTokens, stateConfig.translateY, stateConfig.translateYDirection);

  const textTransform: TextTransform = typographyToken?.textTransform || 'none';

  // Calculate width based on widthMode
  let width: string | undefined;
  if (variant.widthMode === 'fixed') {
    const widthToken = spacingTokens.find((t: SpacingToken) => t.variable === variant.width);
    width = widthToken ? `${widthToken.value}${widthToken.unit}` : undefined;
  } else if (variant.widthMode === 'full') {
    width = '100%';
  }
  // 'auto' means no width set, button adapts to content

  // Calculate height based on heightMode
  let height: string | undefined;
  if (variant.heightMode === 'fixed') {
    const heightToken = spacingTokens.find((t: SpacingToken) => t.variable === variant.height);
    height = heightToken ? `${heightToken.value}${heightToken.unit}` : undefined;
  }
  // 'auto' means no height set, button adapts to content

  // Text overflow styles
  const useEllipsis = variant.textOverflow === 'ellipsis';

  return {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    textDecoration: 'none',
    userSelect: 'none',
    cursor: currentState === 'disabled' ? 'not-allowed' : 'pointer',
    outline: 'none',
    backgroundColor: stateConfig.backgroundColor,
    fontFamily: typographyToken ? `var(${typographyToken.fontFamily})` : 'var(--font-family-primary)',
    fontSize: typographyToken ? `var(${typographyToken.fontSize})` : 'var(--font-size-base)',
    fontWeight: typographyToken ? `var(${typographyToken.fontWeight})` : 'var(--font-weight-bold)',
    color: typographyToken ? `var(${typographyToken.color})` : 'var(--color-text-primary)',
    lineHeight: typographyToken ? `var(${typographyToken.lineHeight})` : 'var(--line-height-normal)',
    letterSpacing: typographyToken ? `var(${typographyToken.letterSpacing})` : 'var(--letter-spacing-normal)',
    textTransform: textTransform,
    borderStyle: variant.borderStyle,
    borderWidth: borderWidth,
    borderColor: stateConfig.borderColor,
    borderRadius: borderRadius,
    boxShadow: shadowValue,
    padding: `${paddingY} ${paddingX}`,
    transition: transition,
    transform: `translateY(${translateY})`,
    opacity: stateConfig.opacity,
    // Size properties
    width: width,
    height: height,
    // Text overflow
    overflow: useEllipsis ? 'hidden' : undefined,
    whiteSpace: useEllipsis ? 'nowrap' : undefined,
    textOverflow: useEllipsis ? 'ellipsis' : undefined,
  };
}

export const ButtonUI = forwardRef<HTMLButtonElement, ButtonUIProps>(
  ({ children, variant, icon, className, disabled, style, forceState, ...props }, ref) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const isMobile = useIsMobile();

    const typographyTokens = useAppSelector(state => state.designTokens.typographyTokens);
    const spacingTokens = useAppSelector(state => state.designTokens.spacingTokens);
    const radiusTokens = useAppSelector(state => state.designTokens.radiusTokens);
    const shadowTokens = useAppSelector(state => state.designTokens.shadowTokens);
    const effectTokens = useAppSelector(state => state.designTokens.effectTokens);

    const typographyToken = typographyTokens.find((t: TypographyToken) => t.variable === variant.typography) || null;

    let currentState: ButtonState = 'default';
    if (forceState) {
      currentState = forceState;
    } else if (disabled) {
      currentState = 'disabled';
    } else if (isActive) {
      currentState = 'active';
    } else if (isHovered) {
      currentState = 'hover';
    }

    const buttonStyles = generateButtonStyles(
      variant,
      currentState,
      typographyToken,
      spacingTokens,
      radiusTokens,
      shadowTokens,
      effectTokens
    );

    const defaultIconConfig: ButtonIconConfig = {
      type: 'none',
      name: '',
      customSvg: '',
      positionDesktop: 'left',
      positionMobile: 'left',
      size: '--spacing-md',
      gap: '--spacing-sm',
    };
    // Use icon prop (per-button), not variant.icon
    const iconConfig = icon || defaultIconConfig;
    const iconPosition = isMobile ? iconConfig.positionMobile : iconConfig.positionDesktop;
    const showIcon = iconConfig.type !== 'none' && iconPosition !== 'none';

    const iconSizeToken = spacingTokens.find((t: SpacingToken) => t.variable === iconConfig.size);
    const iconSizePx = iconSizeToken ? iconSizeToken.value : 16;

    const gapToken = spacingTokens.find((t: SpacingToken) => t.variable === iconConfig.gap);
    const gapPx = gapToken ? `${gapToken.value}${gapToken.unit}` : '8px';

    const stateConfig = variant.states[currentState];
    const iconColor = stateConfig?.iconColor || 'currentColor';

    const iconElement = showIcon ? renderButtonIcon(iconConfig, iconSizePx, iconColor) : null;

    const isVertical = iconPosition === 'top' || iconPosition === 'bottom';
    const flexDirection = isVertical ? 'column' : 'row';

    return (
      <button
        ref={ref}
        className={className}
        disabled={disabled}
        style={{
          ...buttonStyles,
          ...style,
          flexDirection,
          gap: showIcon ? gapPx : undefined,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsActive(false);
        }}
        onMouseDown={() => setIsActive(true)}
        onMouseUp={() => setIsActive(false)}
        {...props}
      >
        {showIcon && (iconPosition === 'left' || iconPosition === 'top') && iconElement}
        {children}
        {showIcon && (iconPosition === 'right' || iconPosition === 'bottom') && iconElement}
      </button>
    );
  }
);

ButtonUI.displayName = 'ButtonUI';
