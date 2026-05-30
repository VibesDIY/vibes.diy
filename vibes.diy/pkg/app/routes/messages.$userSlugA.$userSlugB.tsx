import React, { useEffect, useState } from "react";
import { useParams, useLocation, Navigate } from "react-router-dom";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { DmThread } from "../components/DmThread.js";

export function meta() {
  return [{ title: "Messages - Vibes DIY" }, { name: "description", content: "Direct message thread" }];
}

export default function MessageThreadRoute() {
  const { userSlugA, userSlugB } = useParams<{ userSlugA: string; userSlugB: string }>();
  const location = useLocation();
  const { vibeDiyApi } = useVibesDiy();
  const [mySlugSet, setMySlugSet] = useState<Set<string> | undefined>(undefined);

  useEffect(() => {
    vibeDiyApi.listUserSlugBindings({}).then((res) => {
      if (res.isErr()) return;
      setMySlugSet(new Set(res.Ok().items.map((i) => i.userSlug)));
    });
  }, [vibeDiyApi]);

  const vibeRef = (location.state as { vibeRef?: { userSlug: string; appSlug: string } } | null)?.vibeRef;

  if (!userSlugA || !userSlugB) {
    return <div className="p-4 text-sm">Invalid thread URL.</div>;
  }

  // Once we know the current user's slugs, enforce canonical URL form:
  // - sender (current user) always comes first as userSlugA
  // - if neither slug belongs to the current user, redirect to /messages
  // While loading (mySlugSet undefined) render optimistically with userSlugA as sender.
  if (mySlugSet !== undefined) {
    const ownsA = mySlugSet.has(userSlugA);
    const ownsB = mySlugSet.has(userSlugB);
    if (!ownsA && !ownsB) {
      return <Navigate to="/messages" replace />;
    }
    if (!ownsA && ownsB) {
      // Current user is the recipient in the URL — flip to put their slug first
      return <Navigate to={`/messages/${userSlugB}/${userSlugA}`} replace state={location.state} />;
    }
    // ownsA (with or without ownsB): already canonical
  }

  // userSlugA is the sender (current user); userSlugB is the other participant.
  return (
    <div className="max-w-xl mx-auto h-[calc(100vh-4rem)] flex flex-col pt-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <h2 className="text-base font-semibold">{userSlugB}</h2>
        {vibeRef && (
          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            from {vibeRef.userSlug}/{vibeRef.appSlug}
          </span>
        )}
      </div>
      <DmThread myUserSlug={userSlugA} otherUserSlug={userSlugB} vibeRef={vibeRef} vibeDiyApi={vibeDiyApi} />
    </div>
  );
}
