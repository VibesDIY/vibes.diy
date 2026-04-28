import React, { useEffect, useState } from "react";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import type { MemberItem } from "@vibes.diy/api-types";

interface MembersSectionProps {
  userSlug: string;
  appSlug: string;
}

export function MembersSection({ userSlug, appSlug }: MembersSectionProps) {
  const { vibeDiyApi } = useVibesDiy();
  const [members, setMembers] = useState<MemberItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    vibeDiyApi
      .listMembers({ userSlug, appSlug })
      .then((res) => {
        if (cancelled) return;
        if (res.isOk()) setMembers(res.Ok().members);
        else setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vibeDiyApi, userSlug, appSlug]);

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Members</h3>
      {loading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>
      ) : !members || members.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">No collaborators yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {members.map((m, i) => (
            <li
              key={`${m.displayName}-${m.role}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-xs"
            >
              <span className="font-medium text-gray-800 dark:text-gray-200">{m.displayName}</span>
              <span className="text-gray-500 dark:text-gray-400">{m.role === "editor" ? "editor" : "reader"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
