import React from "react";

interface GroupsIconProps {
  className?: string;
}

/**
 * Groups icon component - represents vibe groups
 */
export const GroupsIcon: React.FC<GroupsIconProps> = ({
  className = "h-5 w-5",
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="7" cy="8" r="4" />
      <circle cx="7" cy="18" r="3" />
      <circle cx="17" cy="8" r="3" />
      <circle cx="17" cy="16" r="4" />
    </svg>
  );
};
