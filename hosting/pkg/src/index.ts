import { fromHono } from "chanfana";
import { AppCreate } from "endpoints/appCreate";
import { ClaudeChat } from "endpoints/claude-chat";
import { ImageEdit, ImageGenerate } from "endpoints/openai-image";
import { OpenRouterChat } from "endpoints/openrouter-chat";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth";
import queueConsumer from "./queue-consumer";
import renderApp from "./renderApp";

// Start a Hono app
const app = new Hono();

// Mount the renderApp router
app.route("/", renderApp);

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/docs",
});

// Add middleware to log Authorization header
openapi.use("/api/*", authMiddleware);

// Register OpenAPI endpoints
openapi.use("/api/*", cors());

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
