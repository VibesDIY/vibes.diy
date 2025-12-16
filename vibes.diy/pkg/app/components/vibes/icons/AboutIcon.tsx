import React from "react";

interface AboutIconProps {
  bgFill?: string;
  fill?: string;
  width?: number;
  height?: number;
}

export function AboutIcon({
  bgFill = "#fff",
  fill = "#2a2a2a",
  width = 44,
  height = 44,
}: AboutIconProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="22" cy="22" r="22" fill={bgFill} />
      <circle
        cx="22"
        cy="22"
        r="10"
        stroke={fill}
        strokeWidth="2"
        fill="none"
      />
      <line x1="22" y1="26" x2="22" y2="22" stroke={fill} strokeWidth="2" />
      <line
        x1="22"
        y1="18"
        x2="22.01"
        y2="18"
        stroke={fill}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
