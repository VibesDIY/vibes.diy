import React from "react";

interface ArrowLeftIconProps {
  width?: number;
  height?: number;
  fill?: string;
  bgFill?: string;
  withCircle?: boolean;
}

export function ArrowLeftIcon({
  width = 19,
  height = 20,
  fill = "#231f20",
  bgFill = "#fff",
  withCircle = false,
}: ArrowLeftIconProps) {
  // If withCircle is true, use a centered viewBox with circle background
  if (withCircle) {
    const circleSize = width;
    const iconScale = 0.9;
    const iconWidth = 19 * iconScale;
    const iconHeight = 20 * iconScale;
    const translateX = (circleSize - iconWidth) / 2;
    const translateY = (circleSize - iconHeight) / 2;

    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${circleSize} ${circleSize}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx={circleSize / 2}
          cy={circleSize / 2}
          r={circleSize / 2}
          fill={bgFill}
        />
        <g
          transform={`translate(${translateX}, ${translateY}) scale(${iconScale})`}
        >
          <path
            fill={fill}
            d="M18,20c.55,0,1-.45,1-1V1c0-.55-.45-1-1-1s-1,.45-1,1v18c0,.55.45,1,1,1Z"
          />
          <path
            fill={fill}
            d="M0,3v12.76c0,1.49,1.2,2.69,2.68,2.7.54,0,1.06-.16,1.51-.46l9.48-6.32c.92-.62,1.16-1.86.54-2.78-.14-.22-.33-.4-.54-.54L3.11,1.36C2.19.75.95.99.34,1.91c-.21.32-.33.7-.34,1.09Z"
          />
        </g>
      </svg>
    );
  }

  // Default without circle
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 19 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>
        <path
          fill={fill}
          d="M18,20c.55,0,1-.45,1-1V1c0-.55-.45-1-1-1s-1,.45-1,1v18c0,.55.45,1,1,1Z"
        />
        <path
          fill={fill}
          d="M0,3v12.76c0,1.49,1.2,2.69,2.68,2.7.54,0,1.06-.16,1.51-.46l9.48-6.32c.92-.62,1.16-1.86.54-2.78-.14-.22-.33-.4-.54-.54L3.11,1.36C2.19.75.95.99.34,1.91c-.21.32-.33.7-.34,1.09Z"
        />
      </g>
    </svg>
  );
}
