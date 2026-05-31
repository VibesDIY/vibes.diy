import React, { useEffect, useState } from "react";
import { useParams, useLocation, Navigate } from "react-router-dom";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { DmThread } from "../components/DmThread.js";

export function meta() {
  return [{ title: "Messages - Vibes DIY" }, { name: "description", content: "Direct message thread" }];
}

export default function MessageThreadRoute() {
  const { ownerHandleA, ownerHandleB } = useParams<{ ownerHandleA: string; ownerHandleB: string }>();
  const location = useLocation();
  const { vibeDiyApi } = useVibesDiy();
  const [mySlugSet, setMySlugSet] = useState<Set<string> | undefined>(undefined);

  useEffect(() => {
    vibeDiyApi.listHandleBindings({}).then((res) => {
      if (res.isErr()) return;
      setMySlugSet(new Set(res.Ok().items.map((i) => i.ownerHandle)));
    });
  }, [vibeDiyApi]);

  const vibeRef = (location.state as { vibeRef?: { ownerHandle: string; appSlug: string } } | null)?.vibeRef;

  if (!ownerHandleA || !ownerHandleB) {
    return <div className="p-4 text-sm">Invalid thread URL.</div>;
  }

  // Once we know the current user's slugs, enforce canonical URL form:
  // - sender (current user) always comes first as ownerHandleA
  // - if neither slug belongs to the current user, redirect to /messages
  // While loading (mySlugSet undefined) render optimistically with ownerHandleA as sender.
  if (mySlugSet !== undefined) {
    const ownsA = mySlugSet.has(ownerHandleA);
    const ownsB = mySlugSet.has(ownerHandleB);
    if (!ownsA && !ownsB) {
      return <Navigate to="/messages" replace />;
    }
    if (!ownsA && ownsB) {
      // Current user is the recipient in the URL — flip to put their slug first
      return <Navigate to={`/messages/${ownerHandleB}/${ownerHandleA}`} replace state={location.state} />;
    }
    // ownsA (with or without ownsB): already canonical
  }

  // ownerHandleA is the sender (current user); ownerHandleB is the other participant.
  return (
    <div className="max-w-xl mx-auto h-[calc(100vh-4rem)] flex flex-col pt-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <h2 className="text-base font-semibold">{ownerHandleB}</h2>
        {vibeRef && (
          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            from {vibeRef.ownerHandle}/{vibeRef.appSlug}
          </span>
        )}
      </div>
      <DmThread myUserSlug={ownerHandleA} otherUserSlug={ownerHandleB} vibeRef={vibeRef} vibeDiyApi={vibeDiyApi} />
    </div>
  );
}
