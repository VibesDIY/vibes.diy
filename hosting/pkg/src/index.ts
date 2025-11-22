import { fromHono } from "chanfana";
import { AppCreate } from "./endpoints/appCreate.js";
import {
  ClaudeChat,
  ImageEdit,
  ImageGenerate,
  OpenRouterChat,
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

// Add Clerk authentication middleware
openapi.use("/api/*", clerkMiddleware());

// Extract user from Clerk auth and set on context
openapi.use("/api/*", async (c, next) => {
  const auth = getAuth(c);

  console.log("🔐 Auth middleware:", {
    hasAuth: !!auth,
    userId: auth?.userId,
    sessionId: auth?.sessionId,
    path: c.req.path,
  });

  if (auth?.userId) {
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
// openapi.post("/api/keys", KeyCreate);

// Register OpenAI image endpoints
openapi.post("/api/openai-image/generate", ImageGenerate);
openapi.post("/api/openai-image/edit", ImageEdit);

// Register OpenRouter chat endpoint
openapi.post("/api/v1/chat/completions", OpenRouterChat);
openapi.post("/api/v1/openrouter/chat/completions", OpenRouterChat);

// Register Claude chat endpoint (with OpenAI-compatible interface)
openapi.post("/api/v1/claude/chat/completions", ClaudeChat);

// Export the Hono app with queue handler for Cloudflare Workers
export default {
  fetch: app.fetch,
  queue: queueConsumer.queue,
};

// Test exports - expose internal modules for testing
export { AppCreate } from "./endpoints/appCreate.js";
// Re-export from hosting-base
export {
  ClaudeChat,
  ImageEdit,
  ImageGenerate,
  OpenRouterChat,
} from "@vibes.diy/hosting-base";
export {
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
  type TokenPayload,
} from "@vibes.diy/hosting-base";
export { PublishEvent } from "./types.js";
export type { PublishEvent as PublishEventType } from "./types.js";
export { default as renderApp } from "./renderApp.js";
export { default as queueConsumer } from "./queue-consumer.js";
