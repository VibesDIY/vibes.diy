import React from "react";
import { CardColor } from "./DraggableSection.types.js";

const titleColorLiteral: Record<CardColor, string> = {
  yellow: "#c3b03b9b",
  red: "#9b30209b",
  blue: "#40799d9b",
  grey: "#61625f9b",
};

const _titleBorderColorLiteral: Record<CardColor, string> = {
  yellow: "#d6a038",
  red: "#c23d2b",
  blue: "#254581",
  grey: "#000000",
};

export const getTitleBarStyle = (color: CardColor): React.CSSProperties => ({
  height: "20px",
  width: "100%",
  backgroundColor: titleColorLiteral[color],
  border: "1px solid black",
  marginBottom: "1px",
});

export const getCardChildrenStyle = (): React.CSSProperties => ({
  padding: "16px",
  backgroundColor: "#FFFFF0",
  color: "#221f20",
  border: `1px solid black`,
  boxShadow: "0 0 0 1px white",
});

export const getCardBasicStyle = (): React.CSSProperties => ({
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  minWidth: "500px",
});

export const getCardStyle = (
  color: CardColor,
  isMobile: boolean,
  isDragging: boolean,
  isStatic = false,
): React.CSSProperties => {
  const base = getCardBasicStyle();

  if (isStatic) {
    // Static mode: behaves like a normal div, 80% width on desktop
    return {
      ...base,
      marginBottom: "16px",
      minWidth: "unset",
      width: isMobile ? "100%" : "80%",
      margin: isMobile ? "0" : "0 auto 16px auto", // Center on desktop
    };
  }

  if (isMobile) {
    return {
      ...base,
      marginBottom: "16px",
      minWidth: "unset",
    };
  }

  return {
    ...base,
    position: "absolute",
    cursor: isDragging ? "grabbing" : "grab",
    userSelect: "none",
    zIndex: isDragging ? 1000 : 1,
  };
};
