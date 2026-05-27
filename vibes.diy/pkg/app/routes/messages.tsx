import React, { useEffect, useState } from "react";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { DmInbox } from "../components/DmInbox.js";

export function meta() {
  return [{ title: "Messages - Vibes DIY" }, { name: "description", content: "Your direct messages" }];
}

export default function MessagesRoute() {
  const { vibeDiyApi } = useVibesDiy();
  const [myUserSlug, setMyUserSlug] = useState<string | undefined>(undefined);

  useEffect(() => {
    vibeDiyApi.listUserSlugBindings({}).then((res) => {
      if (res.isErr()) return;
      const items = res.Ok().items;
      if (items.length > 0) setMyUserSlug(items[0].userSlug);
    });
  }, [vibeDiyApi]);

  return (
    <div className="max-w-xl mx-auto pt-8">
      <h1 className="text-xl font-semibold px-4 pb-4">Messages</h1>
      <DmInbox vibeDiyApi={vibeDiyApi} myUserSlug={myUserSlug} />
    </div>
  );
}
