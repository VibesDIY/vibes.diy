import { Result } from "@adviser/cement";
import {
  createLineStream,
  createDataStream,
  createSseStream,
  createDeltaStream,
  isDeltaLine,
} from "@vibes.diy/call-ai-v2";

export interface ModerationInput {
  userSlug?: string;
  appSlug?: string;
  name?: string;
  url?: string;
}

export interface ModerationResult {
  safe: boolean;
  reason?: string;
}

export type FetchFn = typeof fetch;

const MODERATION_PROMPT = `You are a content moderation system. Analyze the following user-provided content and determine if it's appropriate for public use as a username/profile.

Content to check:
- Username/slug: {userSlug}
- Display name: {name}
- URL: {url}

Reject content that is:
- Offensive, hateful, or discriminatory
- Impersonating others or official entities
- Sexually explicit
- Promoting illegal activities
- Spam or gibberish designed to game systems

Respond with JSON only: {"safe": true, "reason": ""} or {"safe": false, "reason": "brief explanation"}`;

function buildPrompt(content: ModerationInput): string {
  return MODERATION_PROMPT.replace("{userSlug}", content.userSlug || "(not provided)")
    .replace("{name}", content.name || "(not provided)")
    .replace("{url}", content.url || "(not provided)");
}

export async function moderateContent(
  apiKey: string,
  content: ModerationInput,
  fetchFn: FetchFn = fetch
): Promise<Result<ModerationResult>> {
  try {
    const prompt = buildPrompt(content);

    const response = await fetchFn("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vibes.diy",
        "X-Title": "Vibes DIY Content Moderation",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Result.Err(`Moderation API error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      return Result.Err("Moderation API returned no response body");
    }

    const streamId = "moderation";
    const pipeline = response.body
      .pipeThrough(createLineStream(streamId))
      .pipeThrough(createDataStream(streamId))
      .pipeThrough(createSseStream(streamId))
      .pipeThrough(createDeltaStream(streamId, () => crypto.randomUUID()));

    let contentText = "";
    const reader = pipeline.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (isDeltaLine(value)) {
        contentText += value.content;
      }
    }

    const trimmed = contentText.trim();
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Result.Err(`Moderation API returned invalid JSON: ${trimmed}`);
    }

    const result = JSON.parse(jsonMatch[0]) as ModerationResult;
    return Result.Ok(result);
  } catch (error) {
    return Result.Err(`Moderation error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
