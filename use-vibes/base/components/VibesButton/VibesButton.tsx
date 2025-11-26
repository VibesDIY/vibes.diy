import React, { useEffect, useState } from 'react';
import {
  getButtonStyle,
  getMergedButtonStyle,
  getIconContainerStyle,
  getIconStyle,
  getContentWrapperStyle,
  bounceKeyframes,
} from './VibesButton.styles.js';
import logoutIconUrl from '../../assets/logout.png';
import remixIconUrl from '../../assets/remix.png';
import inviteIconUrl from '../../assets/invite.png';
import settingsIconUrl from '../../assets/settings.png';
import backIconUrl from '../../assets/back.png';
import { useMobile } from '../../hooks/useMobile.js';
import '../../styles/colors.css';

// Variant constants
export const BLUE = 'blue' as const;
export const RED = 'red' as const;
export const YELLOW = 'yellow' as const;
export const GRAY = 'gray' as const;

type ButtonVariant = 'blue' | 'red' | 'yellow' | 'gray';
type IconName = 'logout' | 'remix' | 'invite' | 'settings' | 'back';

// Icon map - maps icon names to URLs
const iconMap: Record<IconName, string> = {
  logout: logoutIconUrl,
  remix: remixIconUrl,
  invite: inviteIconUrl,
  settings: settingsIconUrl,
  back: backIconUrl,
};

export interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual variant of the button. In light mode uses standard colors,
   * in dark mode uses vibrant neon/phosphorescent colors.
   * @default 'blue'
   */
  variant?: ButtonVariant;
  children: React.ReactNode;
  onHover?: () => void;
  onUnhover?: () => void;
  icon?: IconName;
  /**
   * When true, button colors remain constant (cream/light) regardless of dark mode.
   * When false, button adapts to dark mode with darker background and lighter text.
   * @default true
   */
  ignoreDarkMode?: boolean;
}

export function VibesButton({
  variant = 'blue',
  children,
  onHover,
  onUnhover,
  icon,
  style: customStyle,
  className = '',
  ignoreDarkMode = false,
  ...props
}: MenuButtonProps) {
  const buttonVariant = variant;
  const [isHovered, setHovered] = useState(false);
  const [isActive, setActive] = useState(false);
  const isMobile = useMobile();

  useEffect(() => {
    if (isHovered) {
      onHover?.();
    } else {
      onUnhover?.();
    }
  }, [isHovered, onHover, onUnhover]);

  const iconUrl = icon ? iconMap[icon] : undefined;

  const baseStyle = getButtonStyle(buttonVariant, isHovered, isActive, isMobile, !!iconUrl);
  const mergedStyle = getMergedButtonStyle(baseStyle, ignoreDarkMode, customStyle);
  const iconContainerStyle = getIconContainerStyle(buttonVariant, isMobile, !!iconUrl);
  const iconStyle = getIconStyle(isMobile, isHovered, isActive);
  const contentWrapperStyle = getContentWrapperStyle(isMobile, !!iconUrl);

  return (
    <>
      <style>{bounceKeyframes}</style>
      <button
        {...props}
        className={className}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setActive(false);
        }}
        onMouseDown={() => setActive(true)}
        onMouseUp={() => setActive(false)}
        style={mergedStyle}
      >
        {iconUrl ? (
          <div style={contentWrapperStyle}>
            <div style={iconContainerStyle}>
              <img src={iconUrl} alt="" style={iconStyle} />
            </div>
            <span>{children}</span>
          </div>
        ) : (
          children
        )}
      </button>
    </>
  );
}
