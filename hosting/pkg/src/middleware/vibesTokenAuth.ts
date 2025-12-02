import { jwtVerify } from "jose";
import { Context } from "hono";

interface VibesTokenPayload {
  userId: string;
  email?: string | null;
  sessionId?: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

interface Variables {
  user: {
    userId: string;
    email?: string;
    sessionId?: string;
  } | null;
}

export function vibesTokenMiddleware() {
  return async (
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: () => Promise<void>,
  ) => {
    // If Clerk already authenticated the user, skip
    const existingUser = c.get("user");
    if (existingUser?.userId) {
      return next();
    }

    // Check for X-Vibes-Token header or Authorization header (if not processed by Clerk)
    // The call-ai library sends Authorization: Bearer <token>
    let vibesToken = c.req.header("X-Vibes-Token");

    if (!vibesToken) {
      const authHeader = c.req.header("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        vibesToken = authHeader.substring(7);
      }
    }

    if (!vibesToken) {
      return next(); // No vibes token, continue (may require auth later)
    }

    try {
      // Verify JWT signature and claims
      // Use CLERK_SECRET_KEY as the shared secret
      const secret = new TextEncoder().encode(c.env.CLERK_SECRET_KEY);
      const { payload } = await jwtVerify<VibesTokenPayload>(
        vibesToken,
        secret,
        {
          issuer: "vibes.diy",
          audience: "vibes.diy-api",
        },
      );

      // Set user context from JWT claims
      c.set("user", {
        userId: payload.userId,
        email: payload.email || undefined,
        sessionId: payload.sessionId,
      });

      console.log("✅ Authenticated via X-Vibes-Token:", payload.userId);
    } catch (error) {
      // Don't log full error to avoid log spam on invalid tokens, just a warning
      // Only log if it looks like a token attempt but failed
      if (vibesToken.length > 20) {
        console.warn("⚠️ Invalid X-Vibes-Token:", (error as Error).message);
      }
      // Don't block request - let endpoint handle missing auth
    }

    return next();
  };
}
