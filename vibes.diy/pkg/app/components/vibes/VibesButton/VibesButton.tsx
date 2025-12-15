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
  AboutIcon,
  ArrowRightIcon,
  FirehoseIcon,
  GroupsIcon,
  HomeIconCircle,
  MyVibesIcon,
} from "../icons/index.js";
import { useMobile } from "@vibes.diy/use-vibes-base";

// Variant constants
export const BLUE = "blue" as const;
export const RED = "red" as const;
export const YELLOW = "yellow" as const;
export const GRAY = "gray" as const;

type ButtonVariant = "blue" | "red" | "yellow" | "gray";
type ButtonType = "square" | "flat" | "flat-rounded" | "form";
type IconName =
  | "login"
  | "remix"
  | "invite"
  | "settings"
  | "back"
  | "about"
  | "firehose"
  | "groups"
  | "home"
  | "myvibes";

// Icon map - maps icon names to React components
const iconMap: Record<
  IconName,
  React.ComponentType<{
    bgFill?: string;
    fill?: string;
    width?: number;
    height?: number;
    withCircle?: boolean;
  }>
> = {
  login: LoginIcon,
  remix: RemixIcon,
  invite: InviteIcon,
  settings: SettingsIcon,
  back: ArrowRightIcon,
  about: AboutIcon,
  firehose: FirehoseIcon,
  groups: GroupsIcon,
  home: HomeIconCircle,
  myvibes: MyVibesIcon,
};

export interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual variant of the button. In light mode uses standard colors,
   * in dark mode uses vibrant neon/phosphorescent colors.
   * @default 'blue'
   */
  variant?: ButtonVariant;
  /**
   * Layout type of the button.
   * - 'square': Default desktop layout (square with vertical icon/text)
   * - 'flat': Always uses mobile layout (horizontal, full width)
   * - 'flat-rounded': Mobile layout with 50% border radius
   * - 'form': Simple form button without icon
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

  // Determine if we should use mobile layout based on buttonType or actual mobile state
  const useMobileLayout =
    buttonType === "flat" || buttonType === "flat-rounded" || isMobile;

  // Form buttons don't render icons
  const shouldRenderIcon = IconComponent && buttonType !== "form";

  const baseStyle = getButtonStyle(
    buttonVariant,
    isHovered,
    isActive,
    useMobileLayout,
    !!shouldRenderIcon,
  );

  // Apply additional styles based on buttonType
  let buttonTypeStyle: React.CSSProperties = {};
  if (buttonType === "flat-rounded") {
    buttonTypeStyle = { borderRadius: "50px" };
  } else if (buttonType === "form") {
    buttonTypeStyle = {
      padding: "12px 24px",
      minWidth: "auto",
      width: "auto",
    };
  }

  const mergedStyle = getMergedButtonStyle(
    { ...baseStyle, ...buttonTypeStyle },
    ignoreDarkMode,
    customStyle,
  );
  const iconContainerStyle = getIconContainerStyle(
    buttonVariant,
    useMobileLayout,
    !!shouldRenderIcon,
  );
  const iconStyle = getIconStyle(useMobileLayout, isHovered, isActive);
  const contentWrapperStyle = getContentWrapperStyle(
    useMobileLayout,
    !!shouldRenderIcon,
  );

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
        {shouldRenderIcon ? (
          <div style={contentWrapperStyle}>
            <div style={iconContainerStyle}>
              <div style={iconStyle}>
                <IconComponent
                  bgFill="var(--vibes-button-icon-bg)"
                  fill="var(--vibes-button-icon-fill)"
                  width={useMobileLayout ? 28 : 50}
                  height={useMobileLayout ? 28 : 50}
                  withCircle={icon === "back"}
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
