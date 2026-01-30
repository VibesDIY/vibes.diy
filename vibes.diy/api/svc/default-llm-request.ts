import { LLMRequest } from "@vibes.diy/call-ai-v2";

export function defaultLLMRequest(
  fn: ((req: LLMRequest) => Promise<Response>) | undefined,
  {
    url,
    apiKey,
    model,
  }: {
    url: string;
    apiKey?: string;
    model: string;
  }
): (req: LLMRequest) => Promise<Response> {
  if (fn) {
    return fn;
  }
  return (req: LLMRequest) =>
    fetch(url, {
      method: "POST",
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        ...req,
        stream: true,
      }),
    });
}
