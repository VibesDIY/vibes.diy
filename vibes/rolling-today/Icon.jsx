import React from "react";

export function Icon({ d, size = 18, fill = "none" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d}
    </svg>
  );
}

export const ICONS = {
  pin: <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />,
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4 M8 2v4 M3 10h18" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </>
  ),
  arrowL: <path d="M19 12H5 M12 19l-7-7 7-7" />,
  arrowR: <path d="M5 12h14 M12 5l7 7-7 7" />,
  home: <path d="M3 12l9-9 9 9 M5 10v10h14V10" />,
  spark: <path d="M5 3v4 M3 5h4 M19 17v4 M17 19h4 M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
  heart: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),
  star: <path d="M12 2.5l2.9 5.88 6.5.94-4.7 4.58 1.11 6.47L12 17.8l-5.81 3.05 1.11-6.47-4.7-4.58 6.5-.94z" />,
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-3-3.87 M9 21v-2a4 4 0 0 1 3-3.87 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  x: <path d="M18 6 6 18 M6 6l12 12" />,
};
