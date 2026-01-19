import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { VibesSwitch } from "../index.js";
import { MoonIcon, SunIcon } from "../vibes/icons/index.js";
import { usePrefersDarkMode } from "../../hooks/index.js";
import {
  getBackgroundStyle,
  getBlackBorderWrapper,
  getBlackBorderInnerWrapper,
  getWrapperStyle,
  getMenuStyle,
  getButtonsWrapper,
  getButtonsNavbar,
  getNavbarButtonIconWrapper,
  getNavbarButtonLabel,
  getLayoutContainerStyle,
  getContentContainerStyle,
  getKeyframes,
} from "./GeneralLayout.styles.js";

export const GeneralLayout = () => {
  const browserPrefersDark = usePrefersDarkMode();

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem("vibes-dark-mode");
    if (stored !== null) {
      return stored === "true";
    }
    return browserPrefersDark;
  });

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const newValue = !prev;
      localStorage.setItem("vibes-dark-mode", String(newValue));
      return newValue;
    });
  };

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
  }, [isDarkMode]);

  useEffect(() => {
    const styleId = "general-layout-keyframes";
    const existingStyle = document.getElementById(styleId);

    if (!existingStyle) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = getKeyframes();
      document.head.appendChild(style);
    }

    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  return (
    <div style={getBlackBorderWrapper()}>
      <div style={getBackgroundStyle(isDarkMode)} />
      <div style={getWrapperStyle()} />
      <div style={getBlackBorderInnerWrapper()}>
        <div style={getLayoutContainerStyle()}>
          <div style={getMenuStyle()}>
            <VibesSwitch size={64} />
            <div style={getButtonsWrapper()}>
              <div className="navbar-button-wrapper">
                <button
                  style={getButtonsNavbar(isDarkMode ? "#fa5c00ff" : "#5398c9")}
                  onClick={toggleDarkMode}
                >
                  <div
                    className="navbar-button-icon"
                    style={getNavbarButtonIconWrapper()}
                  >
                    {isDarkMode ? (
                      <SunIcon
                        fill="var(--vibes-cream)"
                        bgFill="#231F20"
                        width={35}
                        height={35}
                      />
                    ) : (
                      <MoonIcon
                        fill="var(--vibes-cream)"
                        bgFill="#231F20"
                        width={35}
                        height={35}
                      />
                    )}
                  </div>
                  <div
                    className="navbar-button-label"
                    style={getNavbarButtonLabel()}
                  >
                    {isDarkMode ? "Light" : "Dark"}
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div style={getContentContainerStyle()}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};
