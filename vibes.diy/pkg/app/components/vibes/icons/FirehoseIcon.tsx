import React from "react";

interface FirehoseIconProps {
  bgFill?: string;
  fill?: string;
  width?: number;
  height?: number;
}

export function FirehoseIcon({
  bgFill = "#fff",
  fill = "#2a2a2a",
  width = 44,
  height = 44,
}: FirehoseIconProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="22" cy="22" r="22" fill={bgFill} />
      <path
        d="M13.75 24.5l10.5-11.25L22 21.5h8.25L19.75 32.75 22 24.5h-8.25z"
        fill={fill}
        strokeWidth="0"
      />
    </svg>
  );
}
