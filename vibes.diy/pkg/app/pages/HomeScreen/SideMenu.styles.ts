import { CSSProperties } from "react";

// Overlay that covers the screen
export const getSideMenuOverlay = (): CSSProperties => ({
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  zIndex: 9998,
  animation: "fadeIn 0.3s ease-out",
});

// Main container - slides in from right
export const getSideMenuContainer = (): CSSProperties => ({
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
  animation: "slideInRight 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
  fontFamily: "'Alte Haas Grotesk', 'Inter', sans-serif",
});

// Header section with title and close button
export const getSideMenuHeader = (): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "24px",
  borderBottom: "6px solid #231F20",
  backgroundColor: "#fefff2",
});

// Switch wrapper
export const getSideMenuSwitchWrapper = (): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

// Close button
export const getSideMenuCloseButton = (): CSSProperties => ({
  width: "60px",
  height: "60px",
  backgroundColor: "#D92A1C",
  border: "4px solid #231F20",
  color: "#fefff2",
  fontSize: "32px",
  fontWeight: "bold",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease",
  boxShadow: "4px 4px 0px #231F20",
  fontFamily: "'Alte Haas Grotesk', 'Inter', sans-serif",
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
  gap: "16px",
});

// Individual menu item
export const getSideMenuListItem = (): CSSProperties => ({
  backgroundColor: "#ffffff",
  border: "4px solid #231F20",
  padding: "20px 24px",
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "6px 6px 0px #231F20",
  animation: "slideInItem 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) backwards",
  position: "relative",
});

// Icon wrapper
export const getSideMenuIcon = (): CSSProperties => ({
  width: "32px",
  height: "32px",
  marginRight: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
});

// Label text
export const getSideMenuLabel = (): CSSProperties => ({
  fontSize: "20px",
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "1px",
  color: "#231F20",
  fontFamily: "'Alte Haas Grotesk', 'Inter', sans-serif",
});

// Footer section
export const getSideMenuFooter = (): CSSProperties => ({
  padding: "24px",
  borderTop: "6px solid #231F20",
  backgroundColor: "#fefff2",
});

// Login button
export const getSideMenuLoginButton = (): CSSProperties => ({
  width: "100%",
  padding: "20px",
  backgroundColor: "#D92A1C",
  border: "4px solid #231F20",
  color: "#fefff2",
  fontSize: "24px",
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "2px",
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "6px 6px 0px #231F20",
  fontFamily: "'Alte Haas Grotesk', 'Inter', sans-serif",
});
