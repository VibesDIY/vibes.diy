import { CSSProperties } from "react";

// Overlay that covers the screen
export const getSideMenuOverlay = (isClosing = false): CSSProperties => ({
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  zIndex: 9998,
  animation: isClosing
    ? "fadeOut 0.3s ease-out forwards"
    : "fadeIn 0.3s ease-out",
});

// Main container - slides in from right
export const getSideMenuContainer = (isClosing = false): CSSProperties => ({
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  width: "400px",
  maxWidth: "90vw",
  backgroundColor: "#fefff2",
  zIndex: 9999,
  display: "flex",
  flexDirection: "column",
  border: "8px solid #231F20",
  borderRight: "none",
  borderLeft: "none",
  boxShadow: "-12px 0 0 0 #231F20",
  animation: isClosing
    ? "slideOutRight 0.5s cubic-bezier(0.64, 0, 0.66, 0) forwards"
    : "slideInRight 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
  fontFamily: "'Alte Haas Grotesk', 'Inter', sans-serif",
});

// Header section with title and close button
export const getSideMenuHeader = (): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px",
  backgroundColor: "#fefff2",
  position: "relative",
});

// Switch wrapper
export const getSideMenuSwitchWrapper = (): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
});

// Close button
export const getSideMenuCloseButton = (): CSSProperties => ({
  width: "35px",
  height: "35px",
  borderRadius: "8px",
  border: "3px solid rgb(35, 31, 32)",
  color: "black",
  fontSize: "22px",
  fontWeight: "bold",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "0.2s",
  position: "absolute",
  right: "12px",
});

// Navigation container
export const getSideMenuNav = (): CSSProperties => ({
  flex: 1,
  padding: "40px 24px",
  overflowY: "auto",
  backgroundColor: "#fefff2",
});

// Menu list
export const getSideMenuList = (): CSSProperties => ({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "2px",
});

// Menu item animation - 3D flip card entrance
export const getSideMenuItemAnimation = (
  index: number,
  isClosing = false,
): CSSProperties => ({
  animation: isClosing
    ? `slideOutMenuItems 0.6s cubic-bezier(0.6, 0.04, 0.98, 0.335) ${index * 0.05}s forwards`
    : `slideInMenuItems 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${index * 0.07}s forwards`,
  animationFillMode: "both",
  transformStyle: "preserve-3d",
  perspective: "1000px",
});

// Footer section
export const getSideMenuFooter = (): CSSProperties => ({
  padding: "24px",
  backgroundColor: "#fefff2",
});

// Login button
export const getSideMenuLoginButton = (): CSSProperties => ({
  width: "100%",
  padding: "3px",
  backgroundColor: "rgb(55, 154, 206)",
  border: "1px solid rgb(35, 31, 32)",
  color: "rgb(254, 255, 242)",
  fontSize: "24px",
  fontWeight: "bold",
  letterSpacing: "2px",
  cursor: "pointer",
  transition: "0.2s",
  borderRadius: "20px",
});
