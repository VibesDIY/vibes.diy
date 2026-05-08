import { useState, useEffect, useRef } from "react";
import { useFireproof } from "@fireproof/use-fireproof";
import { imgGen as defaultImgGen } from "@vibes.diy/vibe-runtime";
import type { Database } from "@fireproof/use-fireproof";
import type { FileMeta, ImgGenFile, UseImgGenOptions, UseImgGenResult } from "@vibes.diy/vibe-types";
import { addNewVersion } from "./utils.js";
import type { PartialImageDocument } from "@vibes.diy/vibe-types";

// Per-app Firefly-synced ImgGen hook. The runtime auto-attaches via
// Stage B's `vibe.req.registerFPDb` so the doc lives on the per-(user,
// app) cloud peer; the existing `/_files` read handler mints `meta.url`
// for display. Display is `<img src={doc._files[ver.id].url}>` — no
// blob URLs, no `meta.file()`, no AsyncImg.

interface InjectedDeps {
  // Hook-test hatch: allow the test to swap in a synthetic generator
  // without reaching into the iframe runtime.
  imgGen?: (prompt: string, inputImage?: File, model?: string) => Promise<ImgGenFile[]>;
}

export function useImgGen(opts: Partial<UseImgGenOptions> & InjectedDeps): UseImgGenResult {
  const { prompt, _id, database = "ImgGen", skip = false, generationId, inputImage, model, imgGen = defaultImgGen } = opts;
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [document, setDocument] = useState<PartialImageDocument | null>(null);

  const { database: db } = useFireproof((database ?? "ImgGen") as string | Database);
  const currentGenRef = useRef<string | null>(null);

  useEffect(() => {
    if (skip || !_id) return;

    const genKey = `${_id}-${generationId ?? ""}-${inputImage?.name ?? ""}${inputImage?.lastModified ?? ""}-${model ?? ""}`;
    if (currentGenRef.current === genKey) return;
    currentGenRef.current = genKey;

    const isRegen = !!generationId;

    async function run() {
      if (!_id) return;
      let existingDoc: PartialImageDocument | null = null;
      try {
        existingDoc = (await db.get(_id)) as PartialImageDocument;
      } catch {
        // Doc does not yet exist
      }

      const currentVer = existingDoc?.versions?.[existingDoc?.currentVersion ?? 0];
      const modelMatch = !model || currentVer?.model === model;
      // Cache hit: doc has versions, this isn't a regen, and the version's
      // file ref is already on the doc. Display reads via meta.url —
      // nothing more to do.
      if (
        existingDoc?.versions?.length &&
        !isRegen &&
        !inputImage &&
        modelMatch &&
        currentVer?.id &&
        existingDoc._files?.[currentVer.id]
      ) {
        setDocument(existingDoc);
        return;
      }

      const promptText = prompt ?? existingDoc?.prompt;
      if (!promptText) {
        if (existingDoc) setDocument(existingDoc);
        return;
      }

      if (!imgGen) {
        setError(new Error("imgGen not available — vibe-runtime not initialized"));
        return;
      }

      setLoading(true);
      setProgress(10);
      setError(null);

      try {
        const files = await imgGen(promptText, inputImage, model);
        const file = files[0];
        if (!file) throw new Error("No image file returned from service");

        // ImgGenFile (uploadId, cid, mimeType, size) -> FileMeta on the doc.
        // The platform mints meta.url on read.
        const fileMeta: FileMeta = {
          uploadId: file.uploadId,
          type: file.mimeType,
          size: file.size,
          lastModified: Date.now(),
        };

        setProgress(90);

        if (existingDoc?._id && (isRegen || !modelMatch)) {
          const fresh = (await db.get(existingDoc._id)) as PartialImageDocument;
          const updated = addNewVersion(fresh, fileMeta, promptText, model);
          // _files entries are the server-stored ref shape, not File/Blob
          // — DocFiles' typing expects DocFileMeta (which carries `cid`).
          // Cast through unknown to keep the put boundary honest.
          await db.put(updated as unknown as Parameters<typeof db.put>[0]);
          const saved = (await db.get(existingDoc._id)) as PartialImageDocument;
          setDocument(saved);
        } else {
          const now = Date.now();
          await db.put({
            _id,
            type: "image",
            prompt: promptText,
            created: now,
            currentVersion: 0,
            versions: [{ id: "v1", created: now, promptKey: "p1", ...(model ? { model } : {}) }],
            currentPromptKey: "p1",
            prompts: { p1: { text: promptText, created: now } },
            _files: { v1: fileMeta },
          } as unknown as Parameters<typeof db.put>[0]);
          const saved = (await db.get(_id)) as PartialImageDocument;
          setDocument(saved);
        }

        setProgress(100);
        setLoading(false);
      } catch (err: unknown) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
        currentGenRef.current = null;
      }
    }

    run();
  }, [_id, prompt, generationId, skip, db, inputImage, model, imgGen]);

  return { loading, progress, error, document };
}
