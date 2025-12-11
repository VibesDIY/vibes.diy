import { fromHono } from "chanfana";
import { AppCreate } from "./endpoints/appCreate.js";
import { AppGet } from "./endpoints/appGet.js";
import {
  ClaudeChat,
  ImageEdit,
  ImageGenerate,
  OpenRouterChat,
  OpenRouterImageGenerate,
  OpenRouterImageEdit,
} from "@vibes.diy/hosting-base";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import queueConsumer from "./queue-consumer.js";
import renderApp from "./renderApp.js";

// Variables type for context
interface Variables {
  user: {
    sub?: string;
    userId?: string;
    sessionId?: string;
    email?: string;
  } | null;
}

// Start a Hono app
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply CORS globally before route mount
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Title",
      "HTTP-Referer",
      "X-VIBES-Token",
    ],
    maxAge: 86400,
  }),
);

// Mount the renderApp router
app.route("/", renderApp);

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/docs",
});

// Add diagnostic logging for environment variables
openapi.use("/api/*", async (c, next) => {
  const env = c.env as Env;
  console.log("🔍 Environment check:", {
    hasClerkSecretKey: !!env.CLERK_SECRET_KEY,
    hasClerkPublishableKey: !!env.CLERK_PUBLISHABLE_KEY,
    clerkSecretKeyPrefix: env.CLERK_SECRET_KEY?.substring(0, 10),
    clerkPublishableKeyPrefix: env.CLERK_PUBLISHABLE_KEY?.substring(0, 10),
    path: c.req.path,
  });
  await next();
});

// Add Clerk authentication middleware
openapi.use("/api/*", clerkMiddleware());

// Blocked users list
const BLOCKED_USER_IDS = [
  "user_36Awou64ehhLseaItAZE5thsuWD", // Heavy API usage
];

// Extract user from Clerk auth and set on context
openapi.use("/api/*", async (c, next) => {
  const auth = getAuth(c);

  if (auth?.userId) {
    // Check if user is blocked
    if (BLOCKED_USER_IDS.includes(auth.userId)) {
      console.log("🚫 Blocked user attempt:", auth.userId);
      return c.json(
        {
          error: {
            message:
              "Your account has exceeded usage limits. Please reach out about payment at help@vibes.diy",
            type: "access_denied",
            code: 403,
          },
        },
        403,
      );
    }

    // Set user on context for endpoints to access
    c.set("user", {
      userId: auth.userId,
      sessionId: auth.sessionId,
    });
    console.log("✅ User set on context:", auth.userId);
  } else {
    console.log("⚠️  No authenticated user found");
  }

  await next();
});

// Register OpenAPI endpoints
openapi.post("/api/apps", AppCreate);
openapi.get("/api/apps/:slug", AppGet);

// Register OpenAI image endpoints
openapi.post("/api/openai-image/generate", ImageGenerate);
openapi.post("/api/openai-image/edit", ImageEdit);

// Register OpenRouter chat endpoint
openapi.post("/api/v1/chat/completions", OpenRouterChat);
openapi.post("/api/v1/openrouter/chat/completions", OpenRouterChat);

// Register OpenRouter image endpoints
openapi.post("/api/openrouter-image/generate", OpenRouterImageGenerate);
openapi.post("/api/openrouter-image/edit", OpenRouterImageEdit);

// Register Claude chat endpoint (with OpenAI-compatible interface)
// todo file a GitHub issue using gh, saying we should evaluate using this endpoint in the vibes.diy app when a claude model is selected
openapi.post("/api/v1/claude/chat/completions", ClaudeChat);

// Export the Hono app with queue handler for Cloudflare Workers
export default {
  fetch: app.fetch,
  queue: queueConsumer.queue,
};

// Test exports - expose internal modules for testing
export { AppCreate } from "./endpoints/appCreate.js";
export { AppGet } from "./endpoints/appGet.js";
// Re-export from hosting-base
export {
  // the only import of these is tests, they should take direct from hosting-base, and then remove these lines
  // ClaudeChat,
  ImageEdit,
  ImageGenerate,
  OpenRouterChat,
} from "@vibes.diy/hosting-base";
export {
  // evaluate each of these individually to see if the above note applies
  generateVibeSlug,
  parseSubdomain,
  constructSubdomain,
  isValidSubdomain,
  generateInstallId,
  type ParsedSubdomain,
  isCustomDomain,
  isFirstPartyApexDomain,
  isFirstPartySubdomain,
  getFirstPartyDomain,
  FIRST_PARTY_DOMAINS,
  FIRST_PARTY_APEX_DOMAINS,
} from "@vibes.diy/hosting-base";
export { PublishEvent } from "./types.js"; // same as above, its tests only, import direct from base
export type { PublishEvent as PublishEventType } from "./types.js"; // reconcile this with the real PublishEventType in hosting/base/types
export { default as renderApp } from "./renderApp.js";
export { default as queueConsumer } from "./queue-consumer.js";
