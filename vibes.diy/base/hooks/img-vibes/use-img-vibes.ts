import { useState, useEffect, useRef } from "react";
// import { useFireproof } from "@fireproof/use-fireproof";
import type { UseImgVibesOptions, UseImgVibesResult } from "@vibes.diy/use-vibes-types";
import { imgVibes } from "@vibes.diy/vibe-runtime";

/**
 * Hook for generating images via the vibes.diy service API.
 * Routes through the WebSocket bridge: sandbox → host → server mode='img' chat → block.image events.
 *
 * TODO: Re-enable Fireproof storage for persistence once the sandbox DB integration is working.
 */
export function useImgVibes({
  prompt,
  _id,
  options = {},
  // database = "ImgVibes",
  skip = false,
  generationId,
}: Partial<UseImgVibesOptions>): UseImgVibesResult {
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);
  const [document, setDocument] = useState<UseImgVibesResult["document"]>(null);

  // const { database: db } = useFireproof(typeof database === "string" ? database : database.name);

  // Track the current generation to prevent duplicate requests
  const currentGenRef = useRef<string | null>(null);

  // Parse size from options
  const size = (() => {
    const sizeStr = (options as { size?: string }).size;
    if (!sizeStr || typeof sizeStr !== "string") return undefined;
    const [w, h] = sizeStr.split("x").map(Number);
    if (w && h) return { width: w, height: h };
    return undefined;
  })();

  // TODO: Re-enable loading existing document by _id once Fireproof is integrated
  // useEffect(() => {
  //   if (!_id || skip) return;
  //   db.get(_id)
  //     .then((doc: unknown) => {
  //       setDocument(doc as UseImgVibesResult["document"]);
  //       const imgUrl = (doc as { imageUrl?: string }).imageUrl;
  //       if (imgUrl) {
  //         setImageData(imgUrl);
  //       }
  //     })
  //     .catch((e: Error) => {
  //       setError(new Error(`Failed to load image document: ${e.message}`));
  //     });
  // }, [_id, db, skip]);

  // Generate new image when prompt changes
  useEffect(() => {
    if (skip || !prompt || _id) return;
    if (!imgVibes) {
      setError(new Error("imgVibes not available — vibe-runtime not initialized"));
      return;
    }

    const genKey = `${prompt}-${generationId ?? ""}`;
    if (currentGenRef.current === genKey) return;
    currentGenRef.current = genKey;

    setLoading(true);
    setProgress(10);
    setError(null);

    imgVibes(prompt)
      .then(async (urls: string[]) => {
        console.log("[ImgVibes] Received image URL from service:", urls[0], "prompt:", prompt);
        const imageUrl = urls[0];
        if (!imageUrl) {
          throw new Error("No image URL received from service");
        }

        setImageData(imageUrl);
        setProgress(100);
        setLoading(false);

        // TODO: Re-enable Fireproof storage before merge
        // try {
        //   const now = Date.now();
        //   const doc = await db.put({
        //     type: "image",
        //     prompt,
        //     imageUrl,
        //     imageUrls: urls,
        //     created: now,
        //     currentVersion: 0,
        //     versions: [{ id: "v1", created: now }],
        //     currentPromptKey: "p1",
        //     prompts: { p1: { text: prompt, created: now } },
        //   });
        //   const savedDoc = await db.get(doc.id);
        //   setDocument(savedDoc as UseImgVibesResult["document"]);
        // } catch (dbErr) {
        //   console.warn("[ImgVibes] Fireproof storage failed:", dbErr);
        // }
      })
      .catch((err: unknown) => {
        console.error("[ImgVibes] Image generation failed:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
        currentGenRef.current = null;
      });
  }, [prompt, generationId, _id, skip]);

  return {
    imageData,
    loading,
    progress,
    error,
    size,
    document,
  };
}
