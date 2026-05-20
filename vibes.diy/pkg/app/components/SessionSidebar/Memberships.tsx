import React from "react";
import { Link } from "react-router-dom";

interface MembershipItem {
  userSlug: string;
  appSlug: string;
  title: string;
}

// Mock memberships — placeholder data until we wire up real subscription data.
const MOCK_MEMBERSHIPS: MembershipItem[] = [
  { userSlug: "jchris", appSlug: "fireproof-todo", title: "Fireproof Todo" },
  { userSlug: "jchris", appSlug: "vibe-radio", title: "Vibe Radio" },
  { userSlug: "anya", appSlug: "color-lab", title: "Color Lab" },
  { userSlug: "mabels", appSlug: "habit-streaks", title: "Habit Streaks" },
  { userSlug: "selem", appSlug: "moodboard", title: "Moodboard" },
  { userSlug: "team", appSlug: "shared-recipes", title: "Shared Recipes" },
];

interface MembershipsProps {
  onNavigate?: () => void;
}

export function Memberships({ onNavigate }: MembershipsProps) {
  return (
    <ul className="ml-3">
      {MOCK_MEMBERSHIPS.map((item) => {
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
                <span className="truncate">{item.title}</span>
                <span className="truncate text-xs opacity-50">{item.userSlug}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
