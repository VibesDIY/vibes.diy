import { useState, useEffect, useRef } from "react";
import { useFireproof } from "@fireproof/use-fireproof";
import { imgVibes } from "@vibes.diy/vibe-runtime";
import type { UseImgVibesOptions, UseImgVibesResult, PartialImageDocument } from "@vibes.diy/use-vibes-types";
import { addNewVersion } from "./utils.js";

export function useImgVibes({
  prompt,
  _id,
  database = "ImgVibes",
  skip = false,
  generationId,
  inputImage,
}: Partial<UseImgVibesOptions>): UseImgVibesResult {
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [document, setDocument] = useState<PartialImageDocument | null>(null);

  const { database: db } = useFireproof(database ?? "ImgVibes");
  const currentGenRef = useRef<string | null>(null);

  // Single code path: everything goes through _id
  // Component always provides _id (either explicit or hashed from prompt)
  useEffect(() => {
    if (skip || !_id) return;

    const genKey = `${_id}-${generationId ?? ""}-${inputImage?.name ?? ""}${inputImage?.lastModified ?? ""}`;
    if (currentGenRef.current === genKey) return;
    currentGenRef.current = genKey;

    const isRegen = !!generationId;

    async function run() {
      if (!_id) return;
      // Try loading existing doc
      let existingDoc: PartialImageDocument | null = null;
      try {
        existingDoc = (await db.get(_id)) as PartialImageDocument;
      } catch {
        // Doc doesn't exist yet
      }

      // Cache hit: doc exists with versions, and this isn't a regen request or img2img
      if (existingDoc?.versions?.length && !isRegen && !inputImage) {
        const ver = existingDoc.versions[existingDoc.currentVersion ?? 0];
        if (ver?.assetUrl) {
          setDocument(existingDoc);
          setAssetUrl(ver.assetUrl);
          return;
        }
      }

      // Need to generate: either first time, or regen
      const promptText = prompt ?? existingDoc?.prompt;
      if (!promptText) {
        // Doc exists but has no prompt and no versions — nothing to do
        if (existingDoc) setDocument(existingDoc);
        return;
      }

      if (!imgVibes) {
        setError(new Error("imgVibes not available — vibe-runtime not initialized"));
        return;
      }

      setLoading(true);
      setProgress(10);
      setError(null);

      try {
        const urls = await imgVibes(promptText, inputImage);
        const imageUrl = urls[0];
        if (!imageUrl) throw new Error("No image URL received from service");

        setAssetUrl(imageUrl);
        setProgress(90);

        if (existingDoc?._id && isRegen) {
          // Regen: append version to existing doc
          const fresh = (await db.get(existingDoc._id)) as PartialImageDocument;
          const updated = addNewVersion(fresh as Required<PartialImageDocument>, imageUrl, promptText);
          await db.put(updated);
          const saved = (await db.get(existingDoc._id)) as PartialImageDocument;
          setDocument(saved);
        } else {
          // New doc
          const now = Date.now();
          await db.put({
            _id,
            type: "image",
            prompt: promptText,
            created: now,
            currentVersion: 0,
            versions: [{ id: "v1", created: now, promptKey: "p1", assetUrl: imageUrl }],
            currentPromptKey: "p1",
            prompts: { p1: { text: promptText, created: now } },
          });
          const saved = (await db.get(_id)) as PartialImageDocument;
          setDocument(saved);
        }

        setProgress(100);
        setLoading(false);
      } catch (err: unknown) {
        console.error("[ImgVibes] Image generation failed:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
        currentGenRef.current = null;
      }
    }

    run();
  }, [_id, prompt, generationId, skip, db, inputImage]);

  return { assetUrl, loading, progress, error, document };
}
