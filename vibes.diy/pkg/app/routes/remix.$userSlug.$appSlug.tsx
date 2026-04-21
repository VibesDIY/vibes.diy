import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "@clerk/react";
import { toast } from "react-hot-toast";
import { exception2Result } from "@adviser/cement";
import { fireproof } from "@fireproof/use-fireproof";
import type { VibeDocument } from "@vibes.diy/prompts";
import { cx, gridBackground } from "@vibes.diy/base";
import { useVibesDiy } from "../vibes-diy-provider.js";
import { encodeTitle } from "../components/SessionSidebar/utils.js";
import { useDocumentTitle } from "../hooks/useDocumentTitle.js";

export default function RemixRoute() {
  const { userSlug, appSlug, fsId } = useParams<{ userSlug: string; appSlug: string; fsId?: string }>();
  useDocumentTitle(`Remix ${userSlug}/${appSlug} - vibes.diy`);
  const { vibeDiyApi } = useVibesDiy();
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();
  const hasRun = useRef(false);
  const [statusLine] = useState("Forking vibe…");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!userSlug || !appSlug) return;
    if (hasRun.current) return;
    hasRun.current = true;

    (async () => {
      const rFork = await vibeDiyApi.forkApp({ srcUserSlug: userSlug, srcAppSlug: appSlug, srcFsId: fsId });
      if (rFork.isErr()) {
        toast.error(`Remix failed: ${rFork.Err().message}`);
        navigate(`/vibe/${userSlug}/${appSlug}`);
        return;
      }
      const fork = rFork.Ok();

      // Seed the local Fireproof VibeDocument so ChatHeaderContent shows the
      // "remix of" link in the new chat editor. The snapshot slugs come from
      // the server's live resolution at fork time; future renders can
      // re-resolve via srcFsId if the source user/app was renamed.
      const rSeed = await exception2Result(async () => {
        const db = fireproof(`vibe-${fork.appSlug}`);
        const title = `Remix of ${fork.srcAppSlug}`;
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

      // The forked Apps row already points at the source's shared storage
      // refs, so we can land straight on the preview with the source fsId.
      navigate(`/chat/${fork.userSlug}/${fork.appSlug}/${fork.srcFsId}?view=code`);
    })();
  }, [isLoaded, isSignedIn, userSlug, appSlug, fsId, navigate, vibeDiyApi]);

  return (
    <div className={cx(gridBackground, "flex h-screen w-screen items-center justify-center")}>
      <div style={{ color: "var(--vibes-text-primary)" }}>{statusLine}</div>
    </div>
  );
}
