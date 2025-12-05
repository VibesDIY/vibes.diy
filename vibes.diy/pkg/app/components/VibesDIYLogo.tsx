import React from "react";
import { VibesSwitch } from "./vibes/VibesSwitch/VibesSwitch.js";

interface VibesDIYLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  height?: number;
  width?: number;
  size?: number | string;
}

// Logo component using the VibesSwitch from use-vibes-base
const VibesDIYLogo: React.FC<VibesDIYLogoProps> = ({
  className,
  width,
  height,
  size,
  ...props
}) => {
  // Use size if provided, otherwise calculate from width/height
  const effectiveSize = size || width || height || 24;

  return (
    <div className={className} {...props}>
      <VibesSwitch size={effectiveSize} />
    </div>
  );
};

export default VibesDIYLogo;
