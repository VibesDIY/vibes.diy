import { createMiddleware } from "hono/factory";
import { TokenPayload, verifyToken } from "../utils/auth";

type Env = {
  CLOUD_SESSION_TOKEN_PUBLIC_KEY: string;
  CLOUD_SESSION_TOKEN_PUBLIC_KEY_DEV?: string;
};

export type Variables = {
  user: TokenPayload | null;
};

/**
 * Middleware to verify and log JWT tokens from X-VIBES-Token header
 * Skips OPTIONS requests and logs appropriate messages for invalid/missing tokens
 * Sets the verified user payload in context variables if token is valid
 * Note: Authorization header is reserved for API keys (e.g., OpenRouter, OpenAI)
 */
export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  // Initialize user as null
  c.set("user", null);

  if (c.req.method !== "OPTIONS") {
    // Check X-VIBES-Token header for JWT authentication
    const vibesToken = c.req.header("X-VIBES-Token");
    if (vibesToken) {
      try {
        let verified = await verifyToken(
          vibesToken,
          c.env.CLOUD_SESSION_TOKEN_PUBLIC_KEY,
        );
        if (!verified && c.env.CLOUD_SESSION_TOKEN_PUBLIC_KEY_DEV) {
          verified = await verifyToken(
            vibesToken,
            c.env.CLOUD_SESSION_TOKEN_PUBLIC_KEY_DEV,
          );
        }
        if (verified) {
          c.set("user", verified.payload);
          console.log(
            `🔐 Auth: User authenticated via X-VIBES-Token - userId: ${verified.payload.userId}`,
          );
        }
      } catch (error) {
        // Token verification failed
        console.error("Token verification failed:", {
          error: error instanceof Error ? error.message : String(error),
          token: vibesToken.substring(0, 20) + "...", // Log first 20 chars for debugging
          timestamp: new Date().toISOString(),
          path: c.req.path,
          method: c.req.method,
          header: "X-VIBES-Token",
        });
      }
    }
  }
  await next();
});
