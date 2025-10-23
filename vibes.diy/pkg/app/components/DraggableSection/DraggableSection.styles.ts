import React from 'react';
import { CardColor } from './DraggableSection.types.js';

const titleColorLiteral: Record<CardColor, string> = {
  yellow: '#c3b03b9b',
  red: '#9b30209b',
  blue: '#40799d9b',
  grey: '#61625f9b',
};

const titleBorderColorLiteral: Record<CardColor, string> = {
  yellow: '#d6a038',
  red: '#c23d2b',
  blue: '#254581',
  grey: '#000000',
};

const borderColorLiteral: Record<CardColor, string> = {
  yellow: '#d6a038',
  red: '#c23d2b',
  blue: '#254581',
  grey: '#000000',
};

export const getTitleBarStyle = (color: CardColor): React.CSSProperties => ({
  height: '20px',
  width: '100%',
  backgroundColor: titleColorLiteral[color],
  borderBottom: `1px solid ${titleBorderColorLiteral[color]}`,
});

export const getCardChildrenStyle = (color: CardColor): React.CSSProperties => ({
  padding: '16px',
  backgroundColor: '#FFFFF0',
  color: '#221f20',
});

export const getCardBasicStyle = (color: CardColor): React.CSSProperties => ({
  border: `1px solid ${borderColorLiteral[color]}`,
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  minWidth: '500px',
});

export const getCardStyle = (
  color: CardColor,
  isMobile: boolean,
  isDragging: boolean
): React.CSSProperties => {
  const base = getCardBasicStyle(color);

  if (isMobile) {
    return {
      ...base,
      marginBottom: '16px',
      minWidth: 'unset',
    };
  }

  return {
    ...base,
    position: 'absolute',
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    zIndex: isDragging ? 1000 : 1,
  };
};
