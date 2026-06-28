import { useEffect, useRef, useState } from "react";
import type { Dispatch } from "react";
import { exception2Result } from "@adviser/cement";
import { fireproof } from "@fireproof/use-fireproof";
import type { VibeDocument } from "@vibes.diy/prompts";
import type { Conn } from "@vibes.diy/api-types";
import type { PromptAction, HydratedCodeViewFile } from "../routes/chat/prompt-state.js";
import {
  inferCodeViewLanguage,
  isCodeViewFileCandidate,
  normalizeCodeViewPath,
  pickDefaultCodeViewFile,
  sortCodeViewFiles,
} from "../components/ResultPreview/code-view-files.js";

export interface ChatHydrationOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fsId: string | undefined;
  readonly sharedApi: Conn<"shared">;
  readonly dispatch: Dispatch<PromptAction>;
}

export interface ChatHydration {
  // The "remix of" title sourced from the local VibeDocument, or undefined.
  readonly remixOf: string | undefined;
}

/**
 * Owns the chat route's read-only hydration: the local VibeDocument "remix of"
 * indicator, and the code-view file-system hydration for the current fsId.
 * Behavior-preserving extraction from the Chat component
 * (VibesDIY/vibes.diy#2015).
 */
export function useChatHydration(opts: ChatHydrationOpts): ChatHydration {
  const { ownerHandle, appSlug, fsId, sharedApi, dispatch } = opts;

  // Read the local VibeDocument (seeded by the remix route) to show the
  // "remix of" indicator in the header. Best-effort: if the doc is missing
  // or malformed we just render the plain title.
  const [remixOf, setRemixOf] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await exception2Result(async () => {
        const db = fireproof(`vibe-${appSlug}`);
        return (await db.get("vibe")) as VibeDocument;
      });
      if (cancelled) return;
      if (r.isOk() && r.Ok().remixOf) setRemixOf(r.Ok().remixOf);
    })();
    return () => {
      cancelled = true;
    };
  }, [appSlug]);

  // Hydrate code-view files from the canonical Apps.fileSystem for the
  // current fsId. The code panel renders from this snapshot (file-system-
  // primary mode) while chat chunk reconstruction remains secondary context.
  const hydratedFsIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!fsId || !ownerHandle || !appSlug) return;
    if (hydratedFsIdsRef.current.has(fsId)) return;
    hydratedFsIdsRef.current.add(fsId);
    (async () => {
      const rApp = await sharedApi.getAppByFsId({ appSlug, ownerHandle, fsId });
      if (rApp.isErr()) return;
      const app = rApp.Ok();
      const sourceFiles = sortCodeViewFiles(
        app.fileSystem
          .filter((file) => isCodeViewFileCandidate(file.fileName, file.mimeType))
          .map((file) => ({ ...file, fileName: normalizeCodeViewPath(file.fileName) }))
      );
      if (sourceFiles.length === 0) return;

      const hydratedFiles = (
        await Promise.all(
          sourceFiles.map(async (file): Promise<HydratedCodeViewFile | null> => {
            const rRes = await exception2Result(() =>
              fetch(`/assets/cid/?url=${encodeURIComponent(file.assetURI)}&mime=${encodeURIComponent(file.mimeType)}`)
            );
            if (rRes.isErr() || !rRes.Ok().ok) return null;
            const text = await rRes.Ok().text();
            return {
              fileName: file.fileName,
              lang: inferCodeViewLanguage(file.fileName, file.mimeType),
              code: text.split("\n"),
              ...(file.entryPoint ? { entryPoint: true } : {}),
            };
          })
        )
      ).filter((file): file is HydratedCodeViewFile => file !== null);

      if (hydratedFiles.length === 0) return;
      const sortedHydrated = sortCodeViewFiles(hydratedFiles);
      dispatch({ type: "setHydratedFileSystem", fsId, files: sortedHydrated });

      // Keep getCode's legacy fallback seeded to the default file for the fsId.
      const defaultFile = pickDefaultCodeViewFile(sortedHydrated);
      if (defaultFile) {
        dispatch({ type: "setHydratedSource", fsId, code: defaultFile.code });
      }
    })();
  }, [fsId, ownerHandle, appSlug, sharedApi]);

  return { remixOf };
}
