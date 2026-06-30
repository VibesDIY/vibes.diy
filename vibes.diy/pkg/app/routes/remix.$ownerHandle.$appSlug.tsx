import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAuth } from "@clerk/react";
import { toast } from "react-hot-toast";
import { exception2Result } from "@adviser/cement";
import { fireproof } from "@fireproof/use-fireproof";
import type { VibeDocument } from "@vibes.diy/prompts";
import { cx, gridBackground } from "@vibes.diy/base";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { encodeTitle } from "../components/SessionSidebar/utils.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";
import { notifyRecentVibesChanged } from "../hooks/useRecentVibes.js";

export default function RemixRoute() {
  const { ownerHandle, appSlug, fsId } = useParams<{ ownerHandle: string; appSlug: string; fsId?: string }>();
  const [searchParams] = useSearchParams();
  const skipChat = searchParams.get("skipChat") === "true";
  // A non-owner's edit on /vibe forks here, carrying the prompt they typed (or
  // the suggestion chip they tapped) as ?prompt64 so it survives the fork (and
  // the sign-in round-trip — the auth layout preserves path+search). We forward
  // it onto the new copy's chat URL, where the composer pre-fills it (#2675).
  const prompt64 = searchParams.get("prompt64");
  useDocumentTitle(`${skipChat ? "Clone" : "Remix"} ${ownerHandle}/${appSlug} - vibes.diy`);
  const { chatApi } = useVibesDiy();
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();
  const hasRun = useRef(false);
  const [statusLine] = useState(skipChat ? "Cloning vibe…" : "Forking vibe…");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!ownerHandle || !appSlug) return;
    if (hasRun.current) return;
    hasRun.current = true;

    (async () => {
      const rFork = await chatApi.forkApp({ srcUserSlug: ownerHandle, srcAppSlug: appSlug, srcFsId: fsId, skipChat });
      if (rFork.isErr()) {
        toast.error(`${skipChat ? "Clone" : "Remix"} failed: ${rFork.Err().message}`);
        navigate(`/vibe/${ownerHandle}/${appSlug}`);
        return;
      }
      const fork = rFork.Ok();
      notifyRecentVibesChanged();

      // Seed the local Fireproof VibeDocument so ChatHeaderContent shows the
      // "remix of" link later if the user navigates into the chat editor.
      // The snapshot slugs come from the server's live resolution at fork
      // time; future renders can re-resolve via srcFsId if the source was
      // renamed.
      const rSeed = await exception2Result(async () => {
        const db = fireproof(`vibe-${fork.appSlug}`);
        const title = `${skipChat ? "Clone" : "Remix"} of ${fork.srcAppSlug}`;
        await db.put({
          _id: "vibe",
          title,
          encodedTitle: encodeTitle(title),
          remixOf: `${fork.srcUserSlug}/${fork.srcAppSlug}`,
          created_at: Date.now(),
        } satisfies VibeDocument);
      });
      if (rSeed.isErr()) {
        // Non-fatal: local VibeDocument is best-effort header metadata.
      }

      if (skipChat) {
        // Clone: skip the chat/edit stage and land straight on the
        // published /vibe/ URL. `yours=1` triggers the one-time "it's yours now"
        // message on landing (#1856).
        navigate(`/vibe/${fork.ownerHandle}/${fork.appSlug}/${fork.srcFsId}?yours=1`);
        return;
      }

      // Remix: the forked Apps row shares the source's storage refs. Land on
      // /vibe (the editor lives there now, #2876) running the forked app, with
      // the composer pre-filled via prompt64 so the user can apply the change
      // they described on the source vibe (#2675). The old `view=code` deep-link
      // is dropped — /vibe doesn't consume the chat `view` param (the editor is
      // opened from the card), so it lands on the running app, not code view.
      const params = new URLSearchParams();
      if (prompt64) params.set("prompt64", prompt64);
      // `yours=1` triggers the one-time "it's yours now" message on landing (#1856).
      params.set("yours", "1");
      navigate(`/vibe/${fork.ownerHandle}/${fork.appSlug}/${fork.srcFsId}?${params.toString()}`);
    })();
  }, [isLoaded, isSignedIn, ownerHandle, appSlug, fsId, skipChat, prompt64, navigate, chatApi]);

  return (
    <div className={cx(gridBackground, "flex h-screen w-screen items-center justify-center")}>
      <div style={{ color: "var(--vibes-text-primary)" }}>{statusLine}</div>
    </div>
  );
}
