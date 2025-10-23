import React, { useRef, useState, useEffect } from "react";
import { DraggableCardProps } from "./DraggableCard.types.ts";
import { getCardChildrenStyle, getCardStyle, getTitleBarStyle } from "./DraggableCard.styles.ts";
import { useIsMobile } from "../../hooks/index.ts";

export const DraggableCard = ({ color, children, x = 0, y = 0 }: DraggableCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const cardPos = useRef({ x, y });
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile && cardRef.current) {
      cardRef.current.style.transform = `translate(${x}px, ${y}px)`;
    } else if (isMobile && cardRef.current) {
      cardRef.current.style.transform = '';
    }
  }, [x, y, isMobile]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    setIsDragging(true);
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      dragStart.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isMobile) return;
    if (!isDragging) return;
    const container = cardRef.current?.parentElement;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const newX = e.clientX - containerRect.left - dragStart.current.x;
    const newY = e.clientY - containerRect.top - dragStart.current.y;
    cardPos.current = { x: newX, y: newY };
    if (cardRef.current) {
      cardRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    }
  };

  const handleMouseUp = () => {
    if (isMobile) return;
    setIsDragging(false);
  };

  useEffect(() => {
    if (!isMobile && isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isMobile]);

  return (
   <div
      ref={cardRef}
      style={getCardStyle(color, isMobile, isDragging)}
      onMouseDown={isMobile ? undefined : handleMouseDown}
    >
      <div style={getTitleBarStyle(color)} />
      <div style={getCardChildrenStyle(color)}>{children}</div>
    </div>
  );
}
