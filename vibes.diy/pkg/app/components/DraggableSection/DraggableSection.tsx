import React, { useRef, useState, useEffect } from "react";
import { DraggableSectionProps } from "./DraggableSection.types.ts";
import { getCardChildrenStyle, getCardStyle, getTitleBarStyle } from "./DraggableSection.styles.ts";
import { useIsMobile } from "../../hooks/index.ts";

export const DraggableSection = ({ color, children, x = 0, y = 0, static: isStatic = false }: DraggableSectionProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const cardPos = useRef({ x, y });
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isStatic) return; // Skip transform for static sections
    if (!isMobile && cardRef.current) {
      cardRef.current.style.transform = `translate(${x}px, ${y}px)`;
    } else if (isMobile && cardRef.current) {
      cardRef.current.style.transform = '';
    }
  }, [x, y, isMobile, isStatic]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile || isStatic) return; // Disable dragging for static sections
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
    if (isMobile || !isDragging || isStatic) return;
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
    if (isMobile || isStatic) return;
    setIsDragging(false);
  };

  useEffect(() => {
    if (!isMobile && isDragging && !isStatic) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isMobile, isStatic]);

  return (
    <div
      ref={cardRef}
      style={getCardStyle(color, isMobile, isDragging, isStatic)}
      onMouseDown={isMobile || isStatic ? undefined : handleMouseDown}
    >
      <div style={getTitleBarStyle(color)} />
      <div style={getCardChildrenStyle()}>{children}</div>
    </div>
  );
};
