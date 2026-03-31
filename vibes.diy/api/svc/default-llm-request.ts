import { LLMHeaders } from "@vibes.diy/api-types";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { type } from "arktype";

export function defaultLLMRequest(
  fn: ((req: LLMRequest & { headers: LLMHeaders }) => Promise<Response>) | undefined,
  {
    url,
    apiKey,
  }: {
    url: string;
    apiKey?: string;
  }
): (req: LLMRequest & { headers: LLMHeaders }) => Promise<Response> {
  if (fn) {
    return fn;
  }
  return async (req: LLMRequest & { headers: LLMHeaders }) => {
    const stripLLMRequest = type(LLMRequest).onDeepUndeclaredKey("delete")(req);
    if (stripLLMRequest instanceof type.errors) {
      throw new Error(`Invalid LLMRequest: ${stripLLMRequest.summary}`);
    }
    const body = JSON.stringify(stripLLMRequest);
    console.log(`LLM request to ${url} model=${stripLLMRequest.model} apiKey=${apiKey ? apiKey.slice(0, 12) + "..." : "MISSING"}`);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...req.headers,
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        "Content-Type": "application/json",
      },
      body,
    });
    console.log(`LLM response status=${res.status} statusText=${res.statusText}`);
    return res;
  };
}
