import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "@clerk/react";
import { toast } from "react-hot-toast";
import { processStream } from "@adviser/cement";
import { fireproof } from "@fireproof/use-fireproof";
import type { VibeDocument } from "@vibes.diy/prompts";
import { cx, gridBackground } from "@vibes.diy/base";
import { isBlockEnd } from "@vibes.diy/call-ai-v2";
import { sectionEvent } from "@vibes.diy/api-types";
import { type } from "arktype";
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
  const [statusLine, setStatusLine] = useState("Forking vibe…");

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
      // "remix of" link in the new chat editor.
      try {
        const db = fireproof(`vibe-${fork.appSlug}`);
        const title = `Remix of ${appSlug}`;
        await db.put({
          _id: "vibe",
          title,
          encodedTitle: encodeTitle(title),
          remixOf: fork.remixOf,
          created_at: Date.now(),
        } satisfies VibeDocument);
      } catch {
        // Non-fatal: local VibeDocument is best-effort header metadata.
      }

      setStatusLine("Seeding chat with source code…");
      const rChat = await vibeDiyApi.openChat({ userSlug: fork.userSlug, appSlug: fork.appSlug, mode: "chat" });
      if (rChat.isErr()) {
        toast.error(`Could not open remixed chat: ${rChat.Err().message}`);
        navigate(`/chat/${fork.userSlug}/${fork.appSlug}`);
        return;
      }
      const chat = rChat.Ok();

      const rPrompt = await chat.promptFS(fork.sourceFiles);
      if (rPrompt.isErr()) {
        toast.error(`Could not seed remix files: ${rPrompt.Err().message}`);
        navigate(`/chat/${fork.userSlug}/${fork.appSlug}`);
        return;
      }
      const targetPromptId = rPrompt.Ok().promptId;

      // Wait for the block.end carrying the new fsId so we can land directly on
      // the preview with code visible. Mirrors the manual-save flow in
      // chat.$userSlug.$appSlug.tsx (handleOnCodeSave).
      let landedFsId: string | undefined;
      await processStream(chat.sectionStream, async (msg) => {
        const se = sectionEvent(msg);
        if (se instanceof type.errors) return;
        for (const block of se.blocks) {
          if (
            isBlockEnd(block) &&
            (block as { streamId?: string }).streamId === targetPromptId &&
            (block as { fsRef?: { fsId: string } }).fsRef
          ) {
            landedFsId = (block as { fsRef: { fsId: string } }).fsRef.fsId;
            await chat.close();
          }
        }
      });

      const destination = landedFsId
        ? `/chat/${fork.userSlug}/${fork.appSlug}/${landedFsId}?view=code`
        : `/chat/${fork.userSlug}/${fork.appSlug}?view=code`;
      navigate(destination);
    })();
  }, [isLoaded, isSignedIn, userSlug, appSlug, fsId, navigate, vibeDiyApi]);

  return (
    <div className={cx(gridBackground, "flex h-screen w-screen items-center justify-center")}>
      <div style={{ color: "var(--vibes-text-primary)" }}>{statusLine}</div>
    </div>
  );
}
