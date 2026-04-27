import { Result, exception2Result } from "@adviser/cement";

/**
 * Calls the LLM backend in image-modality mode and returns the decoded image bytes.
 *
 * Uses the same backend (LLM_BACKEND_URL) pre-alloc and codegen share, with
 * model `openai/gpt-5-image-mini` and `modalities: ["text", "image"]`. The
 * response's first `data:image/...;base64,...` URI is decoded into a Uint8Array.
 */
export async function generateIcon(args: {
  category: string;
  llmUrl: string;
  llmApiKey: string;
  model?: string;
  fetch?: typeof fetch;
}): Promise<Result<{ bytes: Uint8Array; mime: string }>> {
  const prompt =
    `Minimal black icon on a white background, enclosed in a circle, representing ${args.category}. ` +
    `Use clear, text-free imagery to convey the category. Avoid letters or numbers.`;

  const doFetch = args.fetch ?? fetch;
  const rRes = await exception2Result(() =>
    doFetch(args.llmUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.llmApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model ?? "openai/gpt-5-image-mini",
        modalities: ["text", "image"],
        stream: false,
        messages: [{ role: "user", content: prompt }],
      }),
    })
  );
  if (rRes.isErr()) return Result.Err(rRes);
  const res = rRes.Ok();
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return Result.Err(`icon-gen LLM call failed: ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }

  const rJson = await exception2Result(() => res.json() as Promise<unknown>);
  if (rJson.isErr()) return Result.Err(`icon-gen JSON parse failed: ${rJson.Err()}`);

  const dataUrl = findFirstDataImageUrl(rJson.Ok());
  if (!dataUrl) {
    return Result.Err("icon-gen response did not contain a data:image/ URL");
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return Result.Err("icon-gen data URL not in base64 form");
  const mime = match[1];
  const rBytes = exception2Result(() => Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0)));
  if (rBytes.isErr()) return Result.Err(`icon-gen base64 decode failed: ${rBytes.Err()}`);

  return Result.Ok({ bytes: rBytes.Ok(), mime });
}

// Walks arbitrary JSON looking for the first string that looks like
// `data:image/...;base64,...`. Robust across the two shapes OpenRouter returns
// for image responses: `choices[0].message.images[].image_url.url` and
// `choices[0].message.content[].image_url.url`.
function findFirstDataImageUrl(node: unknown): string | undefined {
  if (typeof node === "string") {
    return node.startsWith("data:image/") ? node : undefined;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findFirstDataImageUrl(item);
      if (hit) return hit;
    }
    return undefined;
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node)) {
      const hit = findFirstDataImageUrl(v);
      if (hit) return hit;
    }
  }
  return undefined;
}
