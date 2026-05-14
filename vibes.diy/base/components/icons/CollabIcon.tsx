import React from "react";

interface CollabIconProps {
  bgFill?: string;
  fill?: string;
  width?: number;
  height?: number;
}

// Three equal-size smiling faces arranged in a triangle, signalling "team /
// collaboration". Matches the visual rhythm of the single-face brand icons
// (RemixIcon, etc.) — same 44x44 viewBox, same two-color fill API.
export function CollabIcon({ bgFill = "#fff", fill = "#2a2a2a", width = 44, height = 44 }: CollabIconProps) {
  const eyeR = 0.9;
  const faces: Array<{ cx: number; cy: number }> = [
    { cx: 22, cy: 11 },
    { cx: 12, cy: 28 },
    { cx: 32, cy: 28 },
  ];
  const r = 8;
  return (
    <svg width={width} height={height} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {faces.map((f, i) => (
        <g key={i}>
          <circle cx={f.cx} cy={f.cy} r={r} fill={bgFill} />
          <circle cx={f.cx - 2.6} cy={f.cy - 1.2} r={eyeR} fill={fill} />
          <circle cx={f.cx + 2.6} cy={f.cy - 1.2} r={eyeR} fill={fill} />
          <path
            d={`M ${f.cx - 2.8} ${f.cy + 1.4} Q ${f.cx} ${f.cy + 4.1} ${f.cx + 2.8} ${f.cy + 1.4}`}
            stroke={fill}
            strokeWidth={1.1}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      ))}
    </svg>
  );
}
