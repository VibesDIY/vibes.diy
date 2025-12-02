import React, { useState, useEffect } from "react";
import { VibesSwitch } from "../../components/index.js";
import {
  getSideMenuOverlay,
  getSideMenuContainer,
  getSideMenuHeader,
  getSideMenuCloseButton,
  getSideMenuNav,
  getSideMenuList,
  getSideMenuListItem,
  getSideMenuIcon,
  getSideMenuLabel,
  getSideMenuSwitchWrapper,
  getSideMenuFooter,
  getSideMenuLoginButton,
} from "./SideMenu.styles.js";
import { HomeIcon } from "../../components/SessionSidebar/HomeIcon.js";
import { StarIcon } from "../../components/SessionSidebar/StarIcon.js";
import { InstallsIcon } from "../../components/SessionSidebar/InstallsIcon.js";
import { FirehoseIcon } from "../../components/SessionSidebar/FirehoseIcon.js";
import { GearIcon } from "../../components/SessionSidebar/GearIcon.js";
import { InfoIcon } from "../../components/SessionSidebar/InfoIcon.js";

export interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => Promise<void>;
}

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

const menuItems: MenuItem[] = [
  { icon: HomeIcon, label: "Home", href: "/" },
  { icon: StarIcon, label: "My Vibes", href: "/vibes/mine" },
  { icon: InstallsIcon, label: "Installs", href: "/vibes/installs" },
  { icon: FirehoseIcon, label: "Firehose", href: "/firehose" },
  { icon: InfoIcon, label: "About", href: "/about" },
];

export const SideMenu: React.FC<SideMenuProps> = ({
  isOpen,
  onClose,
  onLogin,
}) => {
  const [isVisible, setIsVisible] = useState(isOpen);
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      // Start rendering first
      setShouldRender(true);
      // Then trigger the opening animation on next frame
      const raf = requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      // Start closing animation immediately
      setIsVisible(false);
      // After animation completes, stop rendering
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 500); // Match the animation duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <>
      {/* Overlay */}
      <div style={getSideMenuOverlay(!isVisible)} onClick={onClose} />

      {/* Side Menu Container */}
      <div
        className="side-menu-container"
        style={getSideMenuContainer(!isVisible)}
      >
        {/* Header */}
        <div style={getSideMenuHeader()}>
          <div style={getSideMenuSwitchWrapper()}>
            <VibesSwitch size={80} />
          </div>
          <button
            style={getSideMenuCloseButton()}
            onClick={onClose}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav style={getSideMenuNav()}>
          <ul style={getSideMenuList()}>
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.label}
                  className="side-menu-item"
                  style={{
                    ...getSideMenuListItem(!isVisible),
                    animationDelay: !isVisible
                      ? `${(menuItems.length - 1 - index) * 0.05}s`
                      : `${index * 0.05}s`,
                  }}
                >
                  <a
                    href={item.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      textDecoration: "none",
                      color: "inherit",
                      width: "100%",
                    }}
                    onClick={onClose}
                  >
                    <div style={getSideMenuIcon()}>
                      <Icon />
                    </div>
                    <span style={getSideMenuLabel()}>{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer with Login Button */}
        <div style={getSideMenuFooter()}>
          <button style={getSideMenuLoginButton()} onClick={onLogin}>
            LOG IN
          </button>
        </div>
      </div>
    </>
  );
};
