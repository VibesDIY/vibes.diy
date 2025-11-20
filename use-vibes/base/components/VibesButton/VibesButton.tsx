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

// Color constants
export const BLUE = 'blue' as const;
export const RED = 'red' as const;
export const YELLOW = 'yellow' as const;
export const GRAY = 'gray' as const;

type ButtonColors = 'blue' | 'red' | 'yellow' | 'gray';
type IconName = 'logout' | 'remix' | 'invite' | 'settings' | 'back';

const colorMap: Record<ButtonColors, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  yellow: '#eab308',
  gray: '#6b7280',
};

// Icon map - maps icon names to URLs
const iconMap: Record<IconName, string> = {
  logout: logoutIconUrl,
  remix: remixIconUrl,
  invite: inviteIconUrl,
  settings: settingsIconUrl,
  back: backIconUrl,
};

export interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: ButtonColors;
  children: React.ReactNode;
  onHover?: () => void;
  onUnhover?: () => void;
  icon?: IconName;
}

export function VibesButton({
  color = 'blue',
  children,
  onHover,
  onUnhover,
  icon,
  style: customStyle,
  className,
  ...props
}: MenuButtonProps) {
  // Use color if provided, otherwise fall back to variant
  const buttonColor = color;
  const hexColor = colorMap[buttonColor];
  const [isHovered, setHovered] = useState(false);
  const [isActive, setActive] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    };

    checkDarkMode();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);

    return () => mediaQuery.removeEventListener('change', checkDarkMode);
  }, []);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };

    checkMobile();
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    mediaQuery.addEventListener('change', checkMobile);

    return () => mediaQuery.removeEventListener('change', checkMobile);
  }, []);

  useEffect(() => {
    if (isHovered) {
      onHover?.();
    } else {
      onUnhover?.();
    }
  }, [isHovered, onHover, onUnhover]);

  const iconUrl = icon ? iconMap[icon] : undefined;

  const baseStyle = getButtonStyle(buttonColor, isHovered, isActive, isMobile);
  const mergedStyle = getMergedButtonStyle(baseStyle, isDark, customStyle);
  const iconContainerStyle = getIconContainerStyle(hexColor, isMobile, !!iconUrl);
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
