import type { CSSProperties } from "react";

export const getChatContainerStyle = (): CSSProperties => ({
  width: "100%",
  height: "100vh",
  maxHeight: "500px",
  padding: "10px 20px",
  overflowY: "auto",
  overflowX: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  boxSizing: "border-box",
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  paddingBottom: "100px",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  position: "relative",
});

export const getTitleStyle = (): CSSProperties => ({
  fontSize: "12px",
  textAlign: "center",
});

export const getMessageWrapperStyle = (
  isCurrentUser: boolean,
): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  alignItems: isCurrentUser ? "flex-end" : "flex-start",
  maxWidth: "70%",
  alignSelf: isCurrentUser ? "flex-end" : "flex-start",
  gap: "8px",
});

export const getUsernameStyle = (isCurrentUser: boolean): CSSProperties => ({
  fontSize: "12px",
  fontWeight: "600",
  color: "rgba(0, 0, 0, 0.7)",
  marginBottom: "4px",
  paddingLeft: isCurrentUser ? "0" : "12px",
  paddingRight: isCurrentUser ? "12px" : "0",
  textAlign: isCurrentUser ? "right" : "left",
});

export const getMessageBubbleStyle = (
  isCurrentUser: boolean,
): CSSProperties => ({
  padding: "16px 20px",
  borderRadius: isCurrentUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
  background: isCurrentUser ? "#fefff1" : "#5298c8",
  color: isCurrentUser ? "#000000" : "#ffffff",
  wordWrap: "break-word",
  fontSize: "15px",
  lineHeight: "1.6",
  fontWeight: "bold",
  border: isCurrentUser
    ? "1px solid #000"
    : "1px solid rgba(255, 255, 255, 0.1)",
  position: "relative",
});

export const getScrollIndicatorStyle = (): CSSProperties => ({
  position: "sticky",
  bottom: "0px",
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "12px",
  zIndex: 1000,
  pointerEvents: "none",
  marginTop: "auto",
});

export const getScrollTextStyle = (): CSSProperties => ({
  fontSize: "14px",
  fontWeight: "bold",
  color: "#000000",
  textTransform: "uppercase",
  letterSpacing: "1px",
  padding: "8px 16px",
  background: "#FFFFFF",
  border: "3px solid #000000",
  boxShadow: "5px 5px 0px #000000",
});

export const getArrowStyle = (): CSSProperties => ({
  width: "0",
  height: "0",
  borderLeft: "20px solid transparent",
  borderRight: "20px solid transparent",
  borderTop: "30px solid #000000",
  position: "relative",
});

export const getArrowInnerStyle = (): CSSProperties => ({
  position: "absolute",
  top: "-33px",
  left: "50%",
  transform: "translateX(-50%)",
  width: "0",
  height: "0",
  borderLeft: "15px solid transparent",
  borderRight: "15px solid transparent",
  borderTop: "25px solid #FFD700",
});
