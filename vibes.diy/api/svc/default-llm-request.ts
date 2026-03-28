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
  return (req: LLMRequest & { headers: LLMHeaders }) => {
    const stripLLMRequest = type(LLMRequest).onDeepUndeclaredKey("delete")(req);
    if (stripLLMRequest instanceof type.errors) {
      throw new Error(`Invalid LLMRequest: ${stripLLMRequest.summary}`);
    }
    const body = JSON.stringify(stripLLMRequest);
    const msgLengths = stripLLMRequest.messages?.map((m: { content?: unknown }) => JSON.stringify(m.content).length) ?? [];
    console.log(`[llm] model=${stripLLMRequest.model} messages=${stripLLMRequest.messages?.length ?? 0} lengths=[${msgLengths}]`);
    console.log(`[llm-prompt]`, JSON.stringify(stripLLMRequest.messages, null, 2));
    return fetch(url, {
      method: "POST",
      headers: {
        ...req.headers,
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        "Content-Type": "application/json",
      },
      body,
    }).then((res) => {
      console.log(`[llm] model=${stripLLMRequest.model} response status=${res.status}`);
      return res;
    });
  };
}
