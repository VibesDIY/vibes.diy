import React, { useState, useEffect } from "react";
import { VibesSwitch } from "../../components/index.js";
import { VibesButton } from "@vibes.diy/use-vibes-base";
import {
  getSideMenuOverlay,
  getSideMenuContainer,
  getSideMenuHeader,
  getSideMenuCloseButton,
  getSideMenuNav,
  getSideMenuList,
  getSideMenuSwitchWrapper,
  getSideMenuFooter,
  getSideMenuItemAnimation,
} from "./SideMenu.styles.js";

export interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => Promise<void>;
}

interface MenuItem {
  icon: "home" | "myvibes" | "groups" | "firehose" | "about";
  label: string;
  href: string;
  variant?: "blue" | "red" | "yellow" | "gray";
}

const menuItems: MenuItem[] = [
  { icon: "home", label: "Home", href: "/", variant: "blue" },
  {
    icon: "myvibes",
    label: "My Vibes",
    href: "/vibes/mine",
    variant: "yellow",
  },
  {
    icon: "groups",
    label: "Installs",
    href: "/vibes/installs",
    variant: "red",
  },
  {
    icon: "firehose",
    label: "Firehose",
    href: "/firehose",
    variant: "gray",
  },
  { icon: "about", label: "About", href: "/about", variant: "blue" },
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
      {/* CSS Animations */}
      <style>{`
        @keyframes slideInMenuItems {
          0% {
            opacity: 0;
            transform: translateY(-100px) rotateX(90deg) scale(0.3);
            filter: blur(10px);
          }
          50% {
            opacity: 0.8;
            transform: translateY(20px) rotateX(-15deg) scale(1.1);
            filter: blur(2px);
          }
          75% {
            transform: translateY(-8px) rotateX(5deg) scale(0.95);
            filter: blur(0px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) rotateX(0deg) scale(1);
            filter: blur(0px);
          }
        }

        @keyframes slideOutMenuItems {
          0% {
            opacity: 1;
            transform: translateY(0) rotateX(0deg) scale(1);
            filter: blur(0px);
          }
          25% {
            transform: translateY(-8px) rotateX(5deg) scale(0.95);
            filter: blur(0px);
          }
          50% {
            opacity: 0.8;
            transform: translateY(20px) rotateX(-15deg) scale(1.1);
            filter: blur(2px);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) rotateX(90deg) scale(0.3);
            filter: blur(10px);
          }
        }
      `}</style>

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
              return (
                <VibesButton
                  key={index}
                  icon={item.icon}
                  variant={item.variant}
                  onClick={() => {
                    window.location.href = item.href;
                    onClose();
                  }}
                  buttonType="flat-rounded"
                  style={{
                    width: "100%",
                    marginBottom: "12px",
                    ...getSideMenuItemAnimation(index, !isVisible),
                  }}
                >
                  {item.label}
                </VibesButton>
              );
            })}
          </ul>
        </nav>

        {/* Footer with Login Button */}
        <div style={getSideMenuFooter()}>
          <VibesButton variant="blue" buttonType="form" onClick={onLogin}>
            Log In
          </VibesButton>
        </div>
      </div>
    </>
  );
};
