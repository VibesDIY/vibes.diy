import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ClerkAuthProvider, VibesClerkAuth } from "use-vibes";
import SimpleAppLayout from "../components/SimpleAppLayout.js";
import { useAuth } from "../contexts/AuthContext.js";
import {
  CLERK_PUBLISHABLE_KEY,
  CLOUD_SESSION_TOKEN_PUBLIC_KEY,
} from "../config/env.js";

export function meta() {
  return [
    { title: "Login - Vibes DIY" },
    { name: "description", content: "Sign in to your Vibes DIY account" },
  ];
}

function LoginContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated: isVibesAuth } = useAuth();

  // Check if this is an SSO callback route
  const isSSCallback = location.pathname.includes("/sso-callback");

  // If user is already authenticated via existing system, redirect home
  useEffect(() => {
    if (isVibesAuth) {
      navigate("/");
    }
  }, [isVibesAuth, navigate]);

  // Handle successful Clerk authentication (Fireproof integration happens automatically)
  const handleAuthSuccess = (_user: unknown) => {
    console.log("Clerk auth successful");
    // Navigate home - user is now fully authenticated via Fireproof integration
    navigate("/");
  };

  // Handle SSO callback case - show processing UI but still render Clerk component
  if (isSSCallback) {
    return (
      <SimpleAppLayout>
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

            {/* Hidden Clerk component to process SSO callback */}
            <div className="sr-only">
              <VibesClerkAuth
                mode="signin"
                onAuthSuccess={handleAuthSuccess}
                fireproofPublicKey={CLOUD_SESSION_TOKEN_PUBLIC_KEY}
                enableFireproofIntegration={true}
              />
            </div>
          </div>
        </div>
      </SimpleAppLayout>
    );
  }

  return (
    <SimpleAppLayout>
      <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Sign in to Vibes DIY
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Get more credits and save your creative projects
            </p>
          </div>

          <div className="mt-8">
            <VibesClerkAuth
              mode="signin"
              onAuthSuccess={handleAuthSuccess}
              className="mx-auto"
              fireproofPublicKey={CLOUD_SESSION_TOKEN_PUBLIC_KEY}
              enableFireproofIntegration={true}
            />
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{" "}
              <button
                onClick={() => navigate("/signup")}
                className="font-medium text-orange-500 hover:text-orange-600"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    </SimpleAppLayout>
  );
}

export default function Login() {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <SimpleAppLayout>
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
      </SimpleAppLayout>
    );
  }

  return (
    <ClerkAuthProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <LoginContent />
    </ClerkAuthProvider>
  );
}
