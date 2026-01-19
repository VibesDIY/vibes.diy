import { CSSProperties } from "react";

const GeneralLayoutTheme = {
  colors: {
    menuText: "white",
    contentBg: "#1e1e1e",
    shadow: "rgba(0, 0, 0, 0.3)",
    gridLineColor: "var(--vibes-cream)",
  },
  dimensions: {
    padding: "20px",
    gridSize: "32px",
  },
  animation: {
    duration: "0.4s",
    easing: "ease",
    blurAmount: "4px",
  },
  fonts: {
    primary: "'Alte Haas Grotesk', 'Inter', sans-serif",
  },
};

export const getBackgroundStyle = (isDarkMode: boolean): CSSProperties => ({
  position: "fixed",
  top: 10,
  left: 10,
  right: 10,
  bottom: 10,
  borderRadius: "10px",
  backgroundColor: isDarkMode
    ? "var(--vibes-near-black)"
    : "var(--vibes-near-gray)",
  zIndex: 0,
  fontFamily: GeneralLayoutTheme.fonts.primary,
});

export const getWrapperStyle = (): CSSProperties => ({
  position: "fixed",
  top: 10,
  left: 10,
  right: 10,
  bottom: 10,
  borderRadius: "10px",
  pointerEvents: "none",
  zIndex: 2,
  backgroundSize: `${GeneralLayoutTheme.dimensions.gridSize} ${GeneralLayoutTheme.dimensions.gridSize}`,
  backgroundImage: `
      linear-gradient(${GeneralLayoutTheme.colors.gridLineColor} 1px, transparent 1px),
      linear-gradient(90deg, ${GeneralLayoutTheme.colors.gridLineColor} 1px, transparent 1px)
    `,
  fontFamily: GeneralLayoutTheme.fonts.primary,
});

export const getBlackBorderWrapper = (): CSSProperties => ({
  width: "100%",
  height: "100%",
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "black",
});

export const getBlackBorderInnerWrapper = (): CSSProperties => ({
  height: "calc(100% - 20px)",
  width: "calc(100% - 20px)",
  margin: "10px",
  borderRadius: "10px",
  position: "relative",
  overflow: "auto",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
});

export const getMenuStyle = (): CSSProperties => ({
  position: "sticky",
  top: 0,
  left: 0,
  right: 0,
  height: "64px",
  backgroundColor: "var(--vibes-cream)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 20px",
  zIndex: 1000,
  borderBottom: "1px solid black",
  fontFamily: GeneralLayoutTheme.fonts.primary,
  borderTopLeftRadius: "10px",
  borderTopRightRadius: "10px",
  boxShadow: `0px 1px 0px 0px var(--vibes-cream)`,
});

export const getButtonsWrapper = (): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

export const getButtonsNavbar = (color: string): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  height: "63px",
  backgroundColor: color,
  fontFamily: GeneralLayoutTheme.fonts.primary,
  border: "none",
  cursor: "pointer",
  transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
  overflow: "hidden",
  padding: "0",
  position: "relative",
});

export const getNavbarButtonIconWrapper = (): CSSProperties => ({
  width: "64px",
  height: "63px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
});

export const getNavbarButtonLabel = (): CSSProperties => ({
  color: "var(--vibes-cream)",
  fontSize: "14px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
  fontFamily: GeneralLayoutTheme.fonts.primary,
  textTransform: "uppercase",
  letterSpacing: "1.5px",
  opacity: 0,
  transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
  overflow: "hidden",
  display: "inline-block",
  textShadow: "1px 1px 2px rgba(0, 0, 0, 0.3)",
  flexShrink: 0,
});

export const getLayoutContainerStyle = (): CSSProperties => ({
  position: "relative",
  width: "100%",
  height: "100%",
  minHeight: "100vh",
  zIndex: 100,
  backgroundColor: "transparent",
});

export const getContentContainerStyle = (): CSSProperties => ({
  position: "relative",
  zIndex: 10,
  width: "100%",
  minHeight: "100vh",
});

export const getKeyframes = (): string => `
  @keyframes wiggle {
    0%, 100% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(-5deg);
    }
    75% {
      transform: rotate(5deg);
    }
  }

  @keyframes shake {
    0%, 100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-3px);
    }
    75% {
      transform: translateX(3px);
    }
  }

  .navbar-button-wrapper button {
    width: 64px;
    justify-content: center;
  }

  .navbar-button-wrapper .navbar-button-label {
    width: 0;
    padding: 0;
  }

  .navbar-button-wrapper:hover button {
    width: 200px !important;
    justify-content: flex-start !important;
  }

  .navbar-button-wrapper:hover .navbar-button-label {
    opacity: 1 !important;
    width: auto !important;
    max-width: 150px !important;
    padding: 0 16px 0 8px !important;
  }

  .navbar-button-wrapper:hover .navbar-button-icon {
    animation: wiggle 0.6s ease-in-out infinite;
  }

  button:active {
    animation: shake 0.3s ease-in-out;
  }
`;
