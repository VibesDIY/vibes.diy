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
  return (req: LLMRequest) => {
    const body = JSON.stringify({
      model,
      ...req,
      stream: true,
    });
    // console.log("defaultLLMRequest called with:", req, 'model:', model, 'url:', url, 'body:', body);
    return fetch(url, {
      method: "POST",
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        "Content-Type": "application/json",
      },
      body,
    });
  };
}
