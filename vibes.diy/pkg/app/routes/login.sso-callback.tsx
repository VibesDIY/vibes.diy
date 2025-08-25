import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClerkAuthProvider } from "use-vibes";
import { CLERK_PUBLISHABLE_KEY } from "../config/env.js";

export function meta() {
  return [
    { title: "Authentication - Vibes DIY" },
    { name: "description", content: "Processing authentication" },
  ];
}

/**
 * SSO callback route for Clerk authentication
 * This handles the redirect from Clerk after SSO authentication
 */
function SSOCallbackContent() {
  const navigate = useNavigate();

  useEffect(() => {
    // Give Clerk a moment to process the callback, then redirect to home
    const timer = setTimeout(() => {
      navigate("/");
    }, 1000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center py-12 px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Processing authentication...
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Please wait while we complete your sign-in
          </p>
        </div>

        <div className="mt-8">
          <div className="mx-auto h-2 w-24 animate-pulse rounded-full bg-orange-500" />
        </div>
      </div>
    </div>
  );
}

export default function SSOCallback() {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="flex min-h-screen items-center justify-center py-12 px-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-4">
            Configuration Error
          </h2>
          <p className="text-gray-600">
            Clerk publishable key not found. Please add
            VITE_CLERK_PUBLISHABLE_KEY to your environment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClerkAuthProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <SSOCallbackContent />
    </ClerkAuthProvider>
  );
}