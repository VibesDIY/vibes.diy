import { Result, exception2Result } from "@adviser/cement";

const ICON_PROMPT_PREFIX = `Minimal black icon on a white background, enclosed in a circle. ` + `Subject: `;
const ICON_PROMPT_SUFFIX = `. Use clear, text-free imagery. Avoid letters or numbers.`;

export interface GenerateIconArgs {
  description: string;
  model: string;
  fallbackModel: string;
  llmUrl: string;
  llmApiKey: string;
  prodiaToken?: string;
  fetch?: typeof fetch;
}

export interface GenerateIconResult {
  bytes: Uint8Array;
  mime: string;
  model: string;
}

export async function generateIcon(args: GenerateIconArgs): Promise<Result<GenerateIconResult>> {
  const prompt = `${ICON_PROMPT_PREFIX}${args.description}${ICON_PROMPT_SUFFIX}`;
  const doFetch = args.fetch ?? fetch;

  if (args.model.startsWith("prodia/")) {
    if (!args.prodiaToken) {
      console.warn(`PRODIA_TOKEN not configured for model ${args.model}; falling back to OpenRouter (${args.fallbackModel})`);
      return generateIconOpenRouter({
        prompt,
        model: args.fallbackModel,
        llmUrl: args.llmUrl,
        llmApiKey: args.llmApiKey,
        fetch: doFetch,
      });
    }
    return generateIconProdia({ prompt, model: args.model, prodiaToken: args.prodiaToken, fetch: doFetch });
  }
  return generateIconOpenRouter({
    prompt,
    model: args.model,
    llmUrl: args.llmUrl,
    llmApiKey: args.llmApiKey,
    fetch: doFetch,
  });
}

async function generateIconProdia(args: {
  prompt: string;
  model: string;
  prodiaToken: string;
  fetch: typeof fetch;
}): Promise<Result<GenerateIconResult>> {
  const stem = args.model.slice("prodia/".length);
  if (!stem) return Result.Err(`Invalid Prodia model id: ${args.model}`);

  const rRes = await exception2Result(() =>
    args.fetch("https://inference.prodia.com/v2/job", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.prodiaToken}`,
        Accept: "image/png",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: `inference.${stem}.txt2img.v1`,
        config: { prompt: args.prompt },
      }),
    })
  );
  if (rRes.isErr()) return Result.Err(rRes);
  const res = rRes.Ok();
  if (!res.ok) {
    const rBody = await exception2Result(() => res.text());
    const body = rBody.isOk() ? rBody.Ok() : "";
    return Result.Err(`prodia icon-gen failed: ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  const rBuf = await exception2Result(() => res.arrayBuffer());
  if (rBuf.isErr()) return Result.Err(`prodia icon-gen body read failed: ${rBuf.Err()}`);
  return Result.Ok({ bytes: new Uint8Array(rBuf.Ok()), mime: "image/png", model: args.model });
}

async function generateIconOpenRouter(args: {
  prompt: string;
  model: string;
  llmUrl: string;
  llmApiKey: string;
  fetch: typeof fetch;
}): Promise<Result<GenerateIconResult>> {
  const rRes = await exception2Result(() =>
    args.fetch(args.llmUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.llmApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model,
        modalities: ["text", "image"],
        stream: false,
        messages: [{ role: "user", content: args.prompt }],
      }),
    })
  );
  if (rRes.isErr()) return Result.Err(rRes);
  const res = rRes.Ok();
  if (!res.ok) {
    const rBody = await exception2Result(() => res.text());
    const body = rBody.isOk() ? rBody.Ok() : "";
    return Result.Err(`openrouter icon-gen failed: ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  const rJson = await exception2Result(() => res.json() as Promise<unknown>);
  if (rJson.isErr()) return Result.Err(`openrouter icon-gen JSON parse failed: ${rJson.Err()}`);

  const dataUrl = findFirstDataImageUrl(rJson.Ok());
  if (!dataUrl) return Result.Err("openrouter icon-gen response did not contain a data:image/ URL");

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return Result.Err("openrouter icon-gen data URL not in base64 form");
  const mime = match[1];
  const rBytes = exception2Result(() => Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0)));
  if (rBytes.isErr()) return Result.Err(`openrouter icon-gen base64 decode failed: ${rBytes.Err()}`);
  return Result.Ok({ bytes: rBytes.Ok(), mime, model: args.model });
}

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
