import React, { useEffect } from "react";
import { Outlet, useNavigate, useLocation, useSearchParams } from "react-router";
import { useClerk } from "@clerk/clerk-react";
import { BuildURI } from "@adviser/cement";

/**
 * Auth layout route - wraps all protected routes
 * Checks authentication and redirects to login if not signed in
 */
export default function AuthLayout() {
  const clerk = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams ] = useSearchParams()

  useEffect(() => {
    // Wait for Clerk to load
    if (!clerk.loaded) return;

    // If not signed in, redirect to login with return URL
    if (!clerk.isSignedIn) {
      const hasPrompt = searchParams.get("prompt64")
      if (hasPrompt) {
        clerk.redirectToSignIn({
          redirectUrl: BuildURI.from(window.location.href).pathname("/chat/prompt").setParam("prompt64", hasPrompt).toString(),
        })
      } else {
        const redirectTo = encodeURIComponent(location.pathname + location.search);
        navigate(`/login?redirectTo=${redirectTo}`);
      }
    }
  }, [clerk.loaded, clerk.user, navigate, location.pathname, location.search]);

  // Show loading state while checking auth
  if (!clerk.loaded) {
    return <div>Loading...</div>;
  }

  // Show loading if redirecting
  if (!clerk.isSignedIn) {
    return <div>Redirecting to login...</div>;
  }

  // User is authenticated - render child routes
  return <Outlet />;
}


