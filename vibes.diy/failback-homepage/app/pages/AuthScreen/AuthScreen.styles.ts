import { CSSProperties } from "react";

export const getContainerStyle = (): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "calc(100vh - 120px)",
  width: "100%",
  gap: "2rem",
  padding: "2rem",
  position: "relative",
});

export const getBackgroundStyle = (isShredding: boolean): CSSProperties => ({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "calc(400px + 4rem)",
  height: "calc(100vh - 120px - 4rem)",
  backgroundColor: "var(--vibes-gray-lighter)",
  border: "1px solid black",
  borderRadius: "8px",
  zIndex: 0,
  animation: isShredding ? "collapseToLine 1.2s ease-in-out forwards" : "none",
  pointerEvents: "none",
});

export const getCardIconStyle = (isShredding: boolean): CSSProperties => ({
  marginBottom: "1rem",
  animation: isShredding ? "shredCard 0.9s ease-in forwards" : "none",
  position: "relative",
  zIndex: 1,
});

export const getCardIconAnimationStyles = (): string => `
  @keyframes shredCard {
    0% {
      clip-path: inset(0 0 0% 0);
      transform: translateY(0);
    }
    45% {
      clip-path: inset(0 0 0% 0);
      transform: translateY(0);
    }
    80% {
      clip-path: inset(0 0 100% 0);
      transform: translateY(310px);
    }
      100% {
      clip-path: inset(0 0 100% 0);
      transform: translateY(310px);
    }
  }

  @keyframes collapseToLine {
    0% {
      transform: translate(-50%, -50%) scale(1);
      border-radius: 0;
      background-color: "var(--vibes-gray-lighter)";
    }
    40% {
      transform: translate(-50%, -50%) scaleX(0.05) scaleY(0.01);
      border-radius: 50%;
      background-color: black;
    }
    45% {
      transform: translate(-50%, -50%) scaleX(0.05) scaleY(0.01);
      border-radius: 50%;
      background-color: black;
    }
    65% {
      transform: translate(-50%, -50%) scaleX(0.6) scaleY(0.01);
      border-radius: 0;
    }
    80% {
      transform: translate(-50%, -50%) scaleX(0.6) scaleY(0.01);
      border-radius: 0;
    }
      100% {
      transform: translate(-50%, -50%) scaleX(0) scaleY(0.01);
      border-radius: 0;
      background-color: black;
    }
  }
`;

export const getButtonsContainerStyle = (): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  width: "100%",
  maxWidth: "400px",
  position: "relative",
  zIndex: 1,
});

export const getButtonsCenterWrapperStyle = (): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  width: "100%",
  position: "relative",
  paddingTop: "1rem",
  paddingBottom: "1rem",
  zIndex: 1,
});