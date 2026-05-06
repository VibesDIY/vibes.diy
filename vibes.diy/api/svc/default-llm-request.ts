import { LLMHeaders } from "@vibes.diy/api-types";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { type } from "arktype";

export function defaultLLMRequest(
  fn: ((req: LLMRequest & { headers: LLMHeaders }, opts?: { readonly signal?: AbortSignal }) => Promise<Response>) | undefined,
  {
    url,
    apiKey,
  }: {
    url: string;
    apiKey?: string;
  }
): (req: LLMRequest & { headers: LLMHeaders }, opts?: { readonly signal?: AbortSignal }) => Promise<Response> {
  if (fn) {
    return fn;
  }
  return (req, opts) => {
    const stripLLMRequest = type(LLMRequest).onDeepUndeclaredKey("delete")(req);
    if (stripLLMRequest instanceof type.errors) {
      throw new Error(`Invalid LLMRequest: ${stripLLMRequest.summary}`);
    }
    const body = JSON.stringify(stripLLMRequest);
    return fetch(url, {
      method: "POST",
      headers: {
        ...req.headers,
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        "Content-Type": "application/json",
      },
      body,
      signal: opts?.signal,
    });
  };
}
