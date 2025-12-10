import React from 'react';

interface ArrowRightIconProps {
  width?: number;
  height?: number;
  fill?: string;
}

export function ArrowRightIcon({ width = 19, height = 20, fill = '#231f20' }: ArrowRightIconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 19 20" xmlns="http://www.w3.org/2000/svg">
      <g>
        <path
          fill={fill}
          d="M1,20c-.55,0-1-.45-1-1V1C0,.45.45,0,1,0s1,.45,1,1v18c0,.55-.45,1-1,1Z"
        />
        <path
          fill={fill}
          d="M19,3v12.76c0,1.49-1.2,2.69-2.68,2.7-.54,0-1.06-.16-1.51-.46l-9.48-6.32c-.92-.62-1.16-1.86-.54-2.78.14-.22.33-.4.54-.54L15.89,1.36c.92-.61,2.16-.37,2.77.55.21.32.33.7.34,1.09Z"
        />
      </g>
    </svg>
  );
}
