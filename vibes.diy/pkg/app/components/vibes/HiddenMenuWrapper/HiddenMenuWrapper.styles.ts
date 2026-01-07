import type { CSSProperties } from "react";

/**
 * HiddenMenuWrapper Component Styling
 * Following the same pattern as VibeControl styles for consistency
 *
 * Dark mode support:
 * Override CSS variables in your stylesheet using:
 *
 * @media (prefers-color-scheme: dark) {
 *   :root {
 *     --hm-menu-bg: #2a2a2a;
 *     --hm-menu-text: #e0e0e0;
 *     --hm-content-bg: #1a1a1a;
 *     --hm-shadow: rgba(255, 255, 255, 0.1);
 *   }
 * }
 */

// Inject CSS variables for HiddenMenuWrapper component
if (typeof document !== "undefined") {
  const styleId = "hidden-menu-wrapper-vars";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      :root {
        --hm-menu-text: var(--vibes-white);
        --hm-content-bg: #1e1e1e;
        --hm-shadow: rgba(0, 0, 0, 1);
        --hm-grid-line: rgba(255, 255, 255, 0.5);
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --hm-menu-text: var(--vibes-gray-ultralight);
          --hm-content-bg: var(--vibes-near-black);
          --hm-shadow: rgba(255, 255, 255, 0.1);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// CSS Custom Properties (Variables) as JavaScript constants with fallbacks
export const hiddenMenuTheme = {
  colors: {
    menuBg: "var(--vibes-bg-primary)",
    menuText: "var(--hm-menu-text, var(--vibes-white))",
    contentBg: "var(--hm-content-bg, #1e1e1e)",
    shadow: "var(--hm-shadow, rgba(0, 0, 0, 1))",
    gridLineColor: "var(--hm-grid-line, rgba(255, 255, 255, 0.5))",
  },

  zIndex: {
    menu: 5,
    content: 10,
    toggle: 20,
  },

  dimensions: {
    gridSize: "40px",
    padding: "10px",
    bottomOffset: "26px",
  },

  animation: {
    duration: "0.4s",
    easing: "ease",
    blurAmount: "4px",
  },
};

export const getWrapperStyle = (): CSSProperties => ({
  position: "relative",
  overflow: "hidden",
});

export const getMenuStyle = (): CSSProperties => ({
  zIndex: hiddenMenuTheme.zIndex.menu,
  color: hiddenMenuTheme.colors.menuText,
  padding: hiddenMenuTheme.dimensions.padding,
  backgroundColor: hiddenMenuTheme.colors.menuBg,
  backgroundImage: `
    linear-gradient(${hiddenMenuTheme.colors.gridLineColor} 1px, transparent 1px),
    linear-gradient(90deg, ${hiddenMenuTheme.colors.gridLineColor} 1px, transparent 1px)
  `,
  border: `2px solid ${hiddenMenuTheme.colors.gridLineColor}`,
  backgroundSize:
    hiddenMenuTheme.dimensions.gridSize +
    " " +
    hiddenMenuTheme.dimensions.gridSize,
});

export const getMenuStyleWrapper = (): CSSProperties => ({
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  padding: "0px 15px 15px 15px",
  backgroundColor: "black",
  backgroundSize:
    hiddenMenuTheme.dimensions.gridSize +
    " " +
    hiddenMenuTheme.dimensions.gridSize,
});

export const getMenuStyleWrapperGray = (): CSSProperties => ({
  padding: "0px 15px 15px 15px",
  borderBottomRightRadius: "20px",
  borderBottomLeftRadius: "20px",
  backgroundColor: hiddenMenuTheme.colors.menuBg,
  backgroundSize:
    hiddenMenuTheme.dimensions.gridSize +
    " " +
    hiddenMenuTheme.dimensions.gridSize,
});

export const getContentStyle = (): CSSProperties => ({
  filter: "none",
  width: "100%",
  height: "100%",
});

export const getContentWrapperStyle = (
  menuHeight: number,
  menuOpen: boolean,
  isBouncing: boolean,
): CSSProperties => ({
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: hiddenMenuTheme.zIndex.content,
  transition: isBouncing
    ? `filter 0.3s ${hiddenMenuTheme.animation.easing}`
    : `transform ${hiddenMenuTheme.animation.duration} ${hiddenMenuTheme.animation.easing}, filter 0.3s ${hiddenMenuTheme.animation.easing}`,
  transform: menuOpen ? `translateY(-${menuHeight}px)` : "translateY(0)",
  overflowY: "auto",
  borderTopColor: hiddenMenuTheme.colors.menuBg,
  borderTopWidth: "1px",
  borderTopStyle: "solid",
  boxShadow: `0 -2px 10px ${hiddenMenuTheme.colors.shadow}`,
  backgroundColor: hiddenMenuTheme.colors.contentBg,
  animation: isBouncing
    ? "vibes-drop-to-close 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
    : undefined,
  willChange: isBouncing ? "transform" : undefined,
});

export const getInnerContentWrapperStyle = (
  menuOpen: boolean,
): CSSProperties => ({
  filter: menuOpen ? `blur(${hiddenMenuTheme.animation.blurAmount})` : "none",
  width: "100%",
  height: "100%",
});

export const getToggleButtonStyle = (): CSSProperties => ({
  position: "fixed",
  bottom: hiddenMenuTheme.dimensions.bottomOffset,
  right: "5px",
  zIndex: hiddenMenuTheme.zIndex.toggle,
  backgroundColor: "transparent",
  border: "none",
  cursor: "pointer",
});
