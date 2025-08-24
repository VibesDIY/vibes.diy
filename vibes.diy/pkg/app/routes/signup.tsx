import React, { useEffect } from "react";
import { useNavigate } from "react-router";
// TODO: Enable when @vibes.diy/use-vibes-base is properly linked
// import { ClerkAuthProvider, VibesClerkAuth } from "@vibes.diy/use-vibes-base";
import SimpleAppLayout from "../components/SimpleAppLayout.js";
import { useAuth } from "../contexts/AuthContext.js";
import { CLERK_PUBLISHABLE_KEY } from "../config/env.js";

export function meta() {
  return [
    { title: "Sign Up - Vibes DIY" },
    { name: "description", content: "Create your Vibes DIY account" },
  ];
}

function SignUpContent() {
  const navigate = useNavigate();
  const { isAuthenticated: isVibesAuth } = useAuth();

  // If user is already authenticated via existing system, redirect home
  useEffect(() => {
    if (isVibesAuth) {
      navigate("/");
    }
  }, [isVibesAuth, navigate]);

  // Handle successful Clerk authentication
  const handleAuthSuccess = (user: any) => {
    console.log("Clerk signup successful:", user);
    navigate("/");
  };

  return (
    <SimpleAppLayout>
      <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Create your Vibes DIY account
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Start building amazing creative apps with AI
            </p>
          </div>

          <div className="mt-8">
            <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
              <p className="text-gray-600">
                Clerk auth component will be rendered here when use-vibes-base
                is properly linked.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Phase 2: Components are built and ready for integration.
              </p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="font-medium text-orange-500 hover:text-orange-600"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </SimpleAppLayout>
  );
}

export default function SignUp() {
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

  // TODO: Enable ClerkAuthProvider when use-vibes-base is properly linked
  return <SignUpContent />;
}
