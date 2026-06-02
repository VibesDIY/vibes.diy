import React, { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/utils.js";

function monogramFromName(name?: string | null, defaultMonogram = "?"): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return (defaultMonogram.trim() || "?").slice(0, 2).toUpperCase();
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  defaultMonogram?: string;
}

export function Avatar({
  src,
  name,
  alt = "",
  className,
  imageClassName,
  fallbackClassName,
  defaultMonogram,
}: AvatarProps): React.ReactElement {
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [src]);

  const fallbackMonogram = useMemo(() => monogramFromName(name, defaultMonogram), [name, defaultMonogram]);

  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
        className,
      )}
    >
      {src && !avatarError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setAvatarError(true)}
          className={cn("h-full w-full object-cover", imageClassName)}
        />
      ) : (
        <span className={cn("select-none text-xs font-medium uppercase leading-none", fallbackClassName)}>{fallbackMonogram}</span>
      )}
    </span>
  );
}
