import { useState, useEffect, useRef } from "react";
import { useFireproof } from "@fireproof/use-fireproof";
import { imgGen as defaultImgGen } from "@vibes.diy/vibe-runtime";
import type { DocSet } from "@fireproof/use-fireproof";
import type {
  FileMeta,
  ImageDocumentPlain,
  ImgGenFile,
  ImgGenInputImage,
  PartialImageDocument,
  UseImgGenOptions,
  UseImgGenResult,
} from "@vibes.diy/vibe-types";
import { exception2Result, Result } from "@adviser/cement";
import { addNewVersion } from "./utils.js";

// Per-app Firefly-synced ImgGen hook. The runtime auto-attaches via
// Stage B's `vibe.req.registerFPDb` so the doc lives on the per-(user,
// app) cloud peer; the existing `/_files` read handler mints `meta.url`
// for display. Display is `<img src={doc._files[ver.id].url}>` — no
// blob URLs, no `meta.file()`, no AsyncImg.

interface InjectedDeps {
  // Hook-test hatch: allow the test to swap in a synthetic generator
  // without reaching into the iframe runtime.
  imgGen?: (prompt: string, inputImage?: ImgGenInputImage, model?: string) => Promise<Result<ImgGenFile[]>>;
}

export function useImgGen(opts: Partial<UseImgGenOptions> & InjectedDeps): UseImgGenResult {
  const { prompt, _id, database = "ImgGen", skip = false, generationId, inputImage, model, imgGen = defaultImgGen } = opts;
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [document, setDocument] = useState<PartialImageDocument | null>(null);

  // `database` may be either a name string or an already-instantiated Database
  // (the documented prop type). `useFireproof` only accepts a name — passing an
  // object turns it into the cache key, which then gets shipped through the
  // sandbox postMessage bridge as `subscribeDocs(<object>)` and trips
  // DataCloneError. Normalize to the name first.
  const dbName = typeof database === "string" ? database : ((database as { name?: string } | undefined)?.name ?? "ImgGen");
  const { database: db } = useFireproof(dbName);
  const currentGenRef = useRef<string | null>(null);

  useEffect(() => {
    if (skip || !_id) return;

    // Derive a stable identity for whatever shape `inputImage` is:
    //   - File:        name + lastModified
    //   - Blob:        size + type
    //   - DocFileMeta: uploadId (preferred) or size
    // Without this, distinct DocFileMeta objects collapse to the same
    // genKey because Blob/DocFileMeta carry no `name`/`lastModified`,
    // and `currentGenRef` would short-circuit a new image source.
    const inputMeta = inputImage as
      | (Partial<File> & { uploadId?: string; size?: number; type?: string })
      | undefined;
    const inputKey = inputMeta
      ? `${inputMeta.uploadId ?? ""}|${inputMeta.name ?? ""}|${inputMeta.lastModified ?? ""}|${inputMeta.size ?? ""}|${inputMeta.type ?? ""}`
      : "";
    const genKey = `${_id}-${generationId ?? ""}-${inputKey}-${model ?? ""}`;
    if (currentGenRef.current === genKey) return;
    currentGenRef.current = genKey;

    const isRegen = !!generationId;

    async function run() {
      if (!_id) return;
      const rExisting = await exception2Result(() => db.get(_id) as Promise<PartialImageDocument>);
      const existingDoc: PartialImageDocument | null = rExisting.isOk() ? rExisting.Ok() : null;

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

      // `exception2Result` here covers two failure modes uniformly:
      //   - a thrown rejection inside `imgGen` (e.g. browser
      //     image-decode failure in `resizeImageToBase64`, or a custom
      //     injected `imgGen` that throws), and
      //   - a returned `Result.Err` from the runtime imgGen (the
      //     provider error path, e.g. "Prodia request failed: 429").
      // Cement flattens `Promise<Result<T>>` so both collapse here. If
      // we awaited `imgGen` outside this wrapper a thrown rejection
      // would escape after `setLoading(true)` and leave the UI stuck.
      const rFiles = await exception2Result(() => imgGen(promptText, inputImage, model));
      if (rFiles.isErr()) {
        setError(rFiles.Err());
        setLoading(false);
        currentGenRef.current = null;
        return;
      }
      const files = rFiles.Ok();

      // Runtime guarantees `files` is non-empty when Ok — see
      // vibes.diy/vibe/runtime/img-gen.tsx.
      const file = files[0];

      const rRun = await exception2Result(async () => {
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
          // `DocSet<ImageDocumentPlain>` requires `_files` entries to satisfy
          // `DocFileMeta` (which requires `cid`); our wire `FileMeta` carries
          // `uploadId` instead. Tracked upstream — see
          // https://github.com/fireproof-storage/fireproof/issues/1812.
          await db.put<ImageDocumentPlain>(updated as unknown as DocSet<ImageDocumentPlain>);
          const saved = (await db.get(existingDoc._id)) as PartialImageDocument;
          setDocument(saved);
        } else {
          const now = Date.now();
          await db.put<ImageDocumentPlain>({
            _id,
            type: "image",
            prompt: promptText,
            created: now,
            currentVersion: 0,
            versions: [{ id: "v1", created: now, promptKey: "p1", ...(model ? { model } : {}) }],
            currentPromptKey: "p1",
            prompts: { p1: { text: promptText, created: now } },
            _files: { v1: fileMeta },
          } as unknown as DocSet<ImageDocumentPlain>);
          const saved = (await db.get(_id)) as PartialImageDocument;
          setDocument(saved);
        }

        setProgress(100);
        setLoading(false);
      });
      if (rRun.isErr()) {
        setError(rRun.Err());
        setLoading(false);
        currentGenRef.current = null;
      }
    }

    run();
  }, [_id, prompt, generationId, skip, db, inputImage, model, imgGen]);

  return { loading, progress, error, document };
}
