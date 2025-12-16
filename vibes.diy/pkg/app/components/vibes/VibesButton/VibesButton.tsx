import React, { useEffect, useState } from "react";
import {
  getButtonStyle,
  getMergedButtonStyle,
  getIconContainerStyle,
  getIconStyle,
  getContentWrapperStyle,
  bounceKeyframes,
} from "./VibesButton.styles.js";
import {
  LoginIcon,
  RemixIcon,
  InviteIcon,
  SettingsIcon,
  BackIcon,
} from "../icons/index.js";
import { useMobile } from "@vibes.diy/use-vibes-base";

// Variant constants
export const BLUE = "blue" as const;
export const RED = "red" as const;
export const YELLOW = "yellow" as const;
export const GRAY = "gray" as const;

type ButtonVariant = "blue" | "red" | "yellow" | "gray";
type ButtonType = "square" | "flat" | "flat-rounded" | "form";
type IconName = "login" | "remix" | "invite" | "settings" | "back";

// Icon map - maps icon names to React components
const iconMap: Record<
  IconName,
  React.ComponentType<{
    bgFill?: string;
    fill?: string;
    width?: number;
    height?: number;
  }>
> = {
  login: LoginIcon,
  remix: RemixIcon,
  invite: InviteIcon,
  settings: SettingsIcon,
  back: BackIcon,
};

export interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual variant of the button. In light mode uses standard colors,
   * in dark mode uses vibrant neon/phosphorescent colors.
   * @default 'blue'
   */
  variant?: ButtonVariant;
  /**
   * Button type affects styling and behavior
   * @default 'square'
   */
  buttonType?: ButtonType;
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
  variant = "blue",
  buttonType = "square",
  children,
  onHover,
  onUnhover,
  icon,
  style: customStyle,
  className = "",
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

  const IconComponent = icon ? iconMap[icon] : undefined;

  const baseStyle = getButtonStyle(
    buttonVariant,
    isHovered,
    isActive,
    isMobile,
    !!IconComponent,
    buttonType,
  );
  const mergedStyle = getMergedButtonStyle(
    baseStyle,
    ignoreDarkMode,
    customStyle,
    buttonType,
  );
  const iconContainerStyle = getIconContainerStyle(
    buttonVariant,
    isMobile,
    !!IconComponent,
    buttonType,
  );
  const iconStyle = getIconStyle(isMobile, isHovered, isActive);
  const contentWrapperStyle = getContentWrapperStyle(isMobile, !!IconComponent);

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
        {IconComponent ? (
          <div style={contentWrapperStyle}>
            <div style={iconContainerStyle}>
              <div style={iconStyle}>
                <IconComponent
                  bgFill="var(--vibes-button-icon-bg)"
                  fill="var(--vibes-button-icon-fill)"
                  width={isMobile ? 28 : 50}
                  height={isMobile ? 28 : 50}
                />
              </div>
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
