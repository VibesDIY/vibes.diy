import { CSSProperties } from "react";

export const getContainerStyle = (): CSSProperties => ({
  display: "flex",
  height: "100vh",
  width: "100vw",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "var(--vibes-cream)",
});

export const getContentWrapperStyle = (): CSSProperties => ({
  textAlign: "center",
  paddingLeft: "2rem",
  paddingRight: "2rem",
  width: "100%",
});

export const getLoginLayoutStyle = (): CSSProperties => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
});

export const getTextContainerStyle = (): CSSProperties => ({
  width: "300px",
});

export const getTitleStyle = (): CSSProperties => ({
  marginBottom: "1rem",
  fontSize: "1.875rem",
  fontWeight: "bold",
  color: "var(--vibes-text-primary)",
});

export const getCursorStyle = (): CSSProperties => ({
  display: "inline-block",
  width: "3px",
  height: "1em",
  backgroundColor: "var(--vibes-text-primary)",
  marginLeft: "2px",
  animation: "blink 1s step-end infinite",
});

export const getMessageStyle = (): CSSProperties => ({
  marginBottom: "1.5rem",
  fontSize: "1.125rem",
  color: "var(--vibes-text-primary)",
});

export const getBlinkKeyframes = (): string => `
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
`;
