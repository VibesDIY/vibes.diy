import React from "react";

interface TexturedPatternProps {
  width?: number;
  height?: number;
  borderRadius?: number;
}

export function TexturedPattern({
  width = 75.78,
  height = 75.78,
  borderRadius = 20.08,
}: TexturedPatternProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 75.78 75.78"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
    >
      <defs>
        <pattern
          id="textured-pattern"
          x="0"
          y="0"
          width="9"
          height="9"
          patternTransform="translate(-2290.31 -2006.95) scale(.8)"
          patternUnits="userSpaceOnUse"
          viewBox="0 0 9 9"
        >
          <rect fill="none" width="9" height="9" />
          <rect fill="#fff" x="0" y="0" width="9" height="9" />
          <rect fill="#231f20" x="0" y="0" width="1.12" height="1.12" />
          <rect fill="#231f20" x="1.13" y="1.13" width="1.12" height="1.12" />
          <rect fill="#231f20" x="2.25" y="0" width="1.12" height="1.12" />
          <rect fill="#231f20" x="3.38" y="1.13" width="1.12" height="1.12" />
          <rect fill="#231f20" x="4.5" y="0" width="1.12" height="1.12" />
          <rect fill="#231f20" x="5.63" y="1.13" width="1.12" height="1.12" />
          <rect fill="#231f20" x="6.75" y="0" width="1.12" height="1.12" />
          <rect fill="#231f20" x="7.88" y="1.13" width="1.12" height="1.12" />
          <rect fill="#231f20" x="0" y="2.25" width="1.12" height="1.12" />
          <rect fill="#231f20" x="1.13" y="3.38" width="1.12" height="1.12" />
          <rect fill="#231f20" x="2.25" y="2.25" width="1.12" height="1.12" />
          <rect fill="#231f20" x="3.38" y="3.38" width="1.12" height="1.12" />
          <rect fill="#231f20" x="4.5" y="2.25" width="1.12" height="1.12" />
          <rect fill="#231f20" x="5.63" y="3.38" width="1.12" height="1.12" />
          <rect fill="#231f20" x="6.75" y="2.25" width="1.12" height="1.12" />
          <rect fill="#231f20" x="7.88" y="3.38" width="1.12" height="1.12" />
          <rect fill="#231f20" x="0" y="4.5" width="1.12" height="1.12" />
          <rect fill="#231f20" x="1.13" y="5.63" width="1.12" height="1.12" />
          <rect fill="#231f20" x="2.25" y="4.5" width="1.12" height="1.12" />
          <rect fill="#231f20" x="3.38" y="5.63" width="1.12" height="1.12" />
          <rect fill="#231f20" x="4.5" y="4.5" width="1.12" height="1.12" />
          <rect fill="#231f20" x="5.63" y="5.63" width="1.12" height="1.12" />
          <rect fill="#231f20" x="6.75" y="4.5" width="1.12" height="1.12" />
          <rect fill="#231f20" x="7.88" y="5.63" width="1.12" height="1.12" />
          <rect fill="#231f20" x="0" y="6.75" width="1.12" height="1.12" />
          <rect fill="#231f20" x="1.13" y="7.88" width="1.12" height="1.12" />
          <rect fill="#231f20" x="2.25" y="6.75" width="1.12" height="1.12" />
          <rect fill="#231f20" x="3.38" y="7.88" width="1.12" height="1.12" />
          <rect fill="#231f20" x="4.5" y="6.75" width="1.12" height="1.12" />
          <rect fill="#231f20" x="5.63" y="7.88" width="1.12" height="1.12" />
          <rect fill="#231f20" x="6.75" y="6.75" width="1.12" height="1.12" />
          <rect fill="#231f20" x="7.88" y="7.88" width="1.12" height="1.12" />
        </pattern>
      </defs>
      <rect
        fill="url(#textured-pattern)"
        width="75.78"
        height="75.78"
        rx={borderRadius}
        ry={borderRadius}
      />
    </svg>
  );
}
