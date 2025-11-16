import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import { useNavigate } from "react-router";
import { useEffect } from "react";

/**
 * SSO Callback route for Clerk OAuth redirect
 *
 * After authenticating with Clerk (via Google OAuth), the user is redirected here.
 * Clerk's AuthenticateWithRedirectCallback handles the authentication flow and
 * then redirects to the original page via redirectUrlComplete.
 */
export default function SSOCallback() {
  const navigate = useNavigate();

  // Fallback: if something goes wrong, redirect to home after 3 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      // Only redirect if we're still on this page (Clerk didn't handle it)
      if (window.location.pathname === "/sso-callback") {
        navigate("/");
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <AuthenticateWithRedirectCallback />
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Completing sign in...
        </div>
      </div>
    </div>
  );
}
