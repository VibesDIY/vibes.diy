import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";

// Mock Clerk middleware
vi.mock("@hono/clerk-auth", () => ({
  clerkMiddleware: vi.fn(() => async (_c, next) => await next()),
  getAuth: vi.fn(),
}));

describe("User Blocking Middleware", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a test app with the same middleware structure as index.ts
    app = new Hono<{
      Variables: {
        user: {
          userId?: string;
          sessionId?: string;
        } | null;
      };
    }>();

    // Blocked users list (same as in index.ts)
    const BLOCKED_USER_IDS = [
      "user_36Awou64ehhLseaItAZE5thsuWD", // Heavy API usage
    ];

    // Add Clerk authentication middleware
    app.use("/api/*", clerkMiddleware());

    // Extract user from Clerk auth and set on context (with blocking logic)
    app.use("/api/*", async (c, next) => {
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
      }

      await next();
    });

    // Test endpoint
    app.post("/api/test", async (c) => {
      const user = c.get("user");
      if (!user) {
        return c.json(
          {
            error: {
              message:
                "Authentication required. Please log in to use AI features.",
              type: "authentication_error",
              code: 401,
            },
          },
          401,
        );
      }
      return c.json({ success: true, userId: user.userId });
    });
  });

  it("should block the specific user with 403", async () => {
    // Mock the blocked user
    vi.mocked(getAuth).mockReturnValue({
      userId: "user_36Awou64ehhLseaItAZE5thsuWD",
      sessionId: "session123",
    } as ReturnType<typeof getAuth>);

    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const res = await app.fetch(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({
      error: {
        message:
          "Your account has exceeded usage limits. Please reach out about payment at help@vibes.diy",
        type: "access_denied",
        code: 403,
      },
    });
  });

  it("should allow normal authenticated users", async () => {
    // Mock a normal authenticated user
    vi.mocked(getAuth).mockReturnValue({
      userId: "user_normalUser123",
      sessionId: "session456",
    } as ReturnType<typeof getAuth>);

    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const res = await app.fetch(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      success: true,
      userId: "user_normalUser123",
    });
  });

  it("should allow other users with similar IDs", async () => {
    // Test that we're matching the exact user ID, not partial matches
    vi.mocked(getAuth).mockReturnValue({
      userId: "user_36Awou64ehhLseaItAZE5thsuWD_different",
      sessionId: "session789",
    } as ReturnType<typeof getAuth>);

    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const res = await app.fetch(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      success: true,
      userId: "user_36Awou64ehhLseaItAZE5thsuWD_different",
    });
  });

  it("should still require authentication for unauthenticated users", async () => {
    // Mock unauthenticated request
    vi.mocked(getAuth).mockReturnValue(null);

    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const res = await app.fetch(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({
      error: {
        message: "Authentication required. Please log in to use AI features.",
        type: "authentication_error",
        code: 401,
      },
    });
  });

  it("should not affect users with null or undefined userId", async () => {
    // Mock auth with undefined userId
    vi.mocked(getAuth).mockReturnValue({
      userId: undefined,
      sessionId: undefined,
    } as ReturnType<typeof getAuth>);

    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const res = await app.fetch(req);
    const data = await res.json();

    // Should get 401 (authentication required), not 403 (blocked)
    expect(res.status).toBe(401);
    expect(data.error.type).toBe("authentication_error");
  });
});
