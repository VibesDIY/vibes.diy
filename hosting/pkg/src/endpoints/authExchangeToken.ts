import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { SignJWT } from "jose";
import { z } from "zod";

const ExchangeTokenResponse = z.object({
  token: z.string(),
  expiresIn: z.number(),
});

interface Variables {
  user: {
    userId: string;
    email?: string;
    sessionId?: string;
  } | null;
}

export class AuthExchangeToken extends OpenAPIRoute {
  schema = {
    tags: ["Auth"],
    summary: "Exchange Clerk token for vibes JWT",
    responses: {
      "200": {
        description: "Returns signed JWT for API access",
        content: {
          "application/json": {
            schema: ExchangeTokenResponse,
          },
        },
      },
    },
  };

  async handle(c: Context<{ Variables: Variables; Bindings: Env }>) {
    // User is already authenticated via Clerk middleware
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    try {
      // Create signed JWT with 60 second expiry
      // We use CLERK_SECRET_KEY as the signing secret for simplicity since it's already a secure secret available
      const secret = new TextEncoder().encode(c.env.CLERK_SECRET_KEY);
      const expiresIn = 60; // seconds

      const token = await new SignJWT({
        userId: user.userId,
        email: user.email || null,
        sessionId: user.sessionId,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${expiresIn}s`)
        .setIssuer("vibes.diy")
        .setAudience("vibes.diy-api")
        .sign(secret);

      return c.json({
        token,
        expiresIn,
      });
    } catch (error) {
      console.error("Error generating JWT:", error);
      return c.json({ error: "Failed to generate token" }, 500);
    }
  }
}
