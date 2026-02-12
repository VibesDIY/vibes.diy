// app/lib/auth.ts
import { redirect } from "react-router";

/**
 * Checks if user is authenticated via Clerk session cookie
 * Redirects to login if not authenticated
 */
export function requireAuth(request: Request) {
  const url = new URL(request.url);
  const cookies = request.headers.get("Cookie") || "";

  // Clerk stores session token in __session or __clerk_db_jwt cookie
  const hasClerkSession = cookies.includes("__session=") || cookies.includes("__clerk_db_jwt=");

  if (!hasClerkSession) {
    // Save the attempted URL for redirect after login
    const redirectTo = encodeURIComponent(url.pathname + url.search);
    throw redirect(`/login?redirectTo=${redirectTo}`);
  }

  // Session exists - allow access
  return null;
}

// TODO: For production, upgrade to full token verification:
// 1. Install: pnpm add @clerk/backend
// 2. Use verifyToken() to validate the session token
// 3. Return user info from the token
