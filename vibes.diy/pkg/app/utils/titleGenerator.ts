import { callAI, type Message } from "call-ai";
import { VibesDiyEnv } from "../config/env.js";
import type { Segment } from "@vibes.diy/prompts";

/**
 * Generate a title based on the first two segments (markdown and code)
 * Returns a promise that resolves when the title generation is complete
 *
 * @param segments - Array of content segments to analyze
 * @param model - The AI model to use for title generation
 * @param apiKey - The API key to use for the callAI service
 * @returns A promise that resolves to the generated title or null if generation failed
 */
export async function generateTitle(
  segments: Segment[],
  model: string,
  apiKey = "",
): Promise<string> {
  // Get first markdown segment and first code segment (if they exist)
  const firstMarkdown = segments.find((seg) => seg.type === "markdown");
  const firstCode = segments.find((seg) => seg.type === "code");

  // Create content from the first two segments
  let titleContent = "";

  if (firstMarkdown) {
    titleContent += firstMarkdown.content + "\n\n";
  }

  if (firstCode) {
    titleContent +=
      "```\n" + firstCode.content.split("\n").slice(0, 80).join("\n") + "\n```";
  }

  // Format messages for callAI
  const messages: Message[] = [
    {
      role: "system",
      content:
        'You are a helpful assistant that generates short, descriptive titles. Create a concise title (3-5 words) that captures the semantics of the content after presentation. Focus on headers and other markup content. Return only the bare title, no other quotes, text or markup. Don\'t say "AI", "Fireproof" or "app".',
    },
    {
      role: "user",
      content: `Generate a short, descriptive title (3-5 words) for this app, use the React JSX <h1> tag's value if you can find it:\n\n${titleContent}`,
    },
  ];

  // Configure callAI options
  const options = {
    chatUrl: VibesDiyEnv.CALLAI_ENDPOINT().replace(/\/+$/, ""), // Remove trailing slash to prevent double slash
    apiKey: apiKey, // Clerk session token
    model: model,
    headers: {
      "HTTP-Referer": "https://vibes.diy",
      "X-Title": "Vibes DIY",
<<<<<<< HEAD
=======
      "X-VIBES-Token": localStorage.getItem("vibes-diy-auth-token") || "",
>>>>>>> c94155dc (Update auth_token usage to vibes-diy-auth-token)
    },
  };

  try {
    // Use callAI to get the title
    const title = (await callAI(messages, options)) as string;
    return title.trim() || "New Chat";
  } catch (error) {
    console.error("Error generating title:", error);
    return "New Chat";
  }
}
