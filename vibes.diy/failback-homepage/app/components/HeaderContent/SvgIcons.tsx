import React from "react";

interface SvgIconProps {
  className?: string;
  title?: string;
}

export const HomeIcon: React.FC<SvgIconProps> = ({ className = "h-5 w-5" }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
};

export const GearIcon: React.FC<SvgIconProps> = ({ className = "h-5 w-5" }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
};

export const StarIcon: React.FC<SvgIconProps & { filled?: boolean }> = ({
  filled = false,
  className = "h-5 w-5",
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? "0" : "2"}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
};

export const PreviewIcon: React.FC<SvgIconProps & { isLoading?: boolean }> = ({
  className = "h-4 w-4",
  isLoading,
  title,
}) => {
  const spinClass = isLoading === true ? "animate-spin-slow" : "";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${spinClass}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <title>
        {title || (isLoading ? "App is fetching data" : "Preview icon")}
      </title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
};

export const CodeIcon: React.FC<SvgIconProps & { isLoading?: boolean }> = ({
  className = "h-3.5 w-3.5 sm:h-4 sm:w-4",
  isLoading,
  title,
}) => {
  const spinClass = isLoading === true ? "animate-spin-slow" : "";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${spinClass}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <title>{title || "Code icon"}</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  );
};

export const DataIcon: React.FC<SvgIconProps> = ({
  className = "h-3.5 w-3.5 sm:h-4 sm:w-4",
  title,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <title>{title || "Data icon"}</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 15h5m-5-4h10"
      />
    </svg>
  );
};

export const SettingsIcon: React.FC<SvgIconProps> = ({
  className = "h-4 w-4",
  title,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <title>{title || "Settings icon"}</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
};

export const ShareIcon: React.FC<SvgIconProps> = ({
  className = "h-4 w-4",
  title,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <title>{title || "Share icon"}</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  );
};
export const BackArrowIcon: React.FC<SvgIconProps> = ({
  className = "h-5 w-5",
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
};

export const UserIcon: React.FC<
  SvgIconProps & { isVerifying?: boolean; isUserAuthenticated?: boolean }
> = ({
  className = "h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1",
  isVerifying,
  isUserAuthenticated,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${isVerifying ? "animate-pulse" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {isUserAuthenticated ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          fill="currentColor"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      )}
    </svg>
  );
};

export const PublishIcon: React.FC<SvgIconProps> = ({
  className = "h-5 w-5",
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-labelledby="publishSvgTitle"
    >
      <title id="publishSvgTitle">Publish</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 10h2m6 0h2a2 2 0 012 2v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7a2 2 0 012-2"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 16V2m0 0l-4 4m4-4l4 4"
      />
    </svg>
  );
};

export const MinidiscIcon: React.FC<SvgIconProps> = ({
  className = "h-4 w-4",
  title,
}) => {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <title>{title || "Save icon (minidisc)"}</title>
      {/* Rounded rectangle background - 20% bigger than circle */}
      <rect
        x="0.8"
        y="0.8"
        width="22.4"
        height="22.4"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      {/* Minidisc outline */}
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      {/* Inner ring */}
      <circle
        cx="12"
        cy="12"
        r="3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      {/* Label area */}
      <rect
        x="16"
        y="9.5"
        width="6"
        height="5"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth=".8"
      />
      {/* Label lines */}
      <line
        x1="17"
        y1="11"
        x2="21"
        y2="11"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      <line
        x1="17"
        y1="12"
        x2="20"
        y2="12"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      <line
        x1="17"
        y1="13"
        x2="21"
        y2="13"
        stroke="currentColor"
        strokeWidth="0.5"
      />
    </svg>
  );
};
