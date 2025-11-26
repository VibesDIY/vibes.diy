import React from "react";
import { CardColor } from "./DraggableCard.types.js";

const titleColorLiteral: Record<CardColor, string> = {
  yellow: "#FEDD009b",
  red: "#DA291C9b",
  blue: "#009ACE9b",
  grey: "#C3C3C19b",
};

const titleBorderColorLiteral: Record<CardColor, string> = {
  yellow: "#FCA600",
  red: "#7F0100",
  blue: "#002D6A",
  grey: "#000000",
};

const borderColorLiteral: Record<CardColor, string> = {
  yellow: "#FDC000",
  red: "#9F0100",
  blue: "#003886",
  grey: "#000000",
};

const childrensColorLiteral: Record<CardColor, string> = {
  yellow: "#000000",
  red: "#ffffff",
  blue: "#ffffff",
  grey: "#ffffff",
};

const childrensColorBackgroundLiteral: Record<CardColor, string> = {
  yellow: "#FEDD00",
  red: "#DA291C",
  blue: "#009ACE",
  grey: "#C3C3C1",
};

export const getTitleBarStyle = (color: CardColor): React.CSSProperties => ({
  height: "10px",
  width: "100%",
  backgroundColor: titleColorLiteral[color],
  borderBottom: `1px solid ${titleBorderColorLiteral[color]}`,
});

export const getCardChildrenStyle = (
  color: CardColor,
): React.CSSProperties => ({
  padding: "16px 8px",
  backgroundColor: childrensColorBackgroundLiteral[color],
  color: childrensColorLiteral[color],
});

export const getCardBasicStyle = (color: CardColor): React.CSSProperties => ({
  border: `1px solid ${borderColorLiteral[color]}`,
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
});

export const getCardStyle = (
  color: CardColor,
  isMobile: boolean,
  isDragging: boolean,
): React.CSSProperties => {
  const base = getCardBasicStyle(color);

  if (isMobile) {
    return {
      ...base,
      marginBottom: "16px",
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
