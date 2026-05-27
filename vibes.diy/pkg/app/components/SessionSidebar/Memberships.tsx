import React from "react";
import { Link } from "react-router-dom";
import { useMemberships } from "../../hooks/useMemberships.js";

const SIDEBAR_LIMIT = 10;

interface MembershipsProps {
  onNavigate?: () => void;
}

export function Memberships({ onNavigate }: MembershipsProps) {
  const { items, loading } = useMemberships(SIDEBAR_LIMIT);

  if (loading && items.length === 0) {
    return (
      <ul className="ml-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="border-b border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2 pl-2 pr-10 py-2">
              <div className="h-6 w-6 shrink-0 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
              <div className="h-3 rounded bg-black/10 dark:bg-white/10 animate-pulse flex-1" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return <p className="ml-5 py-2 text-xs text-light-primary/40 dark:text-dark-primary/40">No memberships yet</p>;
  }

  return (
    <ul className="ml-3">
      {items.map((item) => {
        const key = `${item.userSlug}/${item.appSlug}`;
        return (
          <li key={key} className="group relative border-b border-black/5 dark:border-white/5">
            <Link
              to={`/chat/${item.userSlug}/${item.appSlug}`}
              onClick={onNavigate}
              className="flex items-center gap-2 pl-2 pr-10 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              <span className="h-6 w-6 shrink-0" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{item.title ?? item.appSlug}</span>
                <span className="truncate text-xs opacity-50">{item.userSlug}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
