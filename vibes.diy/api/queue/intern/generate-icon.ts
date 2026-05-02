import { Result, exception2Result } from "@adviser/cement";

export async function generateIcon(args: {
  description: string;
  llmUrl: string;
  llmApiKey: string;
  model?: string;
  fetch?: typeof fetch;
}): Promise<Result<{ bytes: Uint8Array; mime: string }>> {
  const prompt =
    `Minimal black icon on a white background, enclosed in a circle. ` +
    `Subject: ${args.description}. ` +
    `Use clear, text-free imagery. Avoid letters or numbers.`;

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
    const rBody = await exception2Result(() => res.text());
    const body = rBody.isOk() ? rBody.Ok() : "";
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
