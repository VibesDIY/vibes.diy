import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { DmThread } from "../components/DmThread.js";

export function meta() {
  return [{ title: "Messages - Vibes DIY" }, { name: "description", content: "Direct message thread" }];
}

export default function MessageThreadRoute() {
  const { userSlugA, userSlugB } = useParams<{ userSlugA: string; userSlugB: string }>();
  const location = useLocation();
  const { vibeDiyApi } = useVibesDiy();
  const [myUserSlug, setMyUserSlug] = useState<string | undefined>(undefined);

  useEffect(() => {
    vibeDiyApi.listUserSlugBindings({}).then((res) => {
      if (res.isErr()) return;
      const items = res.Ok().items;
      if (items.length === 0) return;
      // A user may have multiple slugs. Find which one appears in the URL so we
      // correctly identify the current user even if items[0] is not the URL param.
      const matchInUrl = items.find((i) => i.userSlug === userSlugA || i.userSlug === userSlugB);
      setMyUserSlug(matchInUrl?.userSlug ?? items[0].userSlug);
    });
  }, [vibeDiyApi, userSlugA, userSlugB]);

  const vibeRef = (location.state as { vibeRef?: { userSlug: string; appSlug: string } } | null)?.vibeRef;

  if (!userSlugA || !userSlugB) {
    return <div className="p-4 text-sm">Invalid thread URL.</div>;
  }

  // Determine which param is "me" once we know the current user's slug.
  // While loading, fall back to userSlugA as "me" so the layout renders immediately.
  const resolvedMySlug = myUserSlug ?? userSlugA;
  const otherUserSlug = resolvedMySlug === userSlugA ? userSlugB : userSlugA;

  return (
    <div className="max-w-xl mx-auto h-[calc(100vh-4rem)] flex flex-col pt-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <h2 className="text-base font-semibold">{otherUserSlug}</h2>
        {vibeRef && (
          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            from {vibeRef.userSlug}/{vibeRef.appSlug}
          </span>
        )}
      </div>
      <DmThread myUserSlug={resolvedMySlug} otherUserSlug={otherUserSlug} vibeRef={vibeRef} vibeDiyApi={vibeDiyApi} />
    </div>
  );
}
