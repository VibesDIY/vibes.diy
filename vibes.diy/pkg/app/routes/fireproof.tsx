import React, { useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardApi } from "@fireproof/core-protocols-dashboard";
import type { ResEnsureUser } from "@fireproof/core-protocols-dashboard";
import type { Result } from "@adviser/cement";
import SimpleAppLayout from "../components/SimpleAppLayout.js";
import { HomeIcon } from "../components/SessionSidebar/HomeIcon.js";
import { VibesDiyEnv } from "../config/env.js";

export function meta() {
  return [
    { title: "Fireproof Dashboard - Vibes DIY" },
    {
      name: "description",
      content: "Manage your Fireproof tenants and ledgers",
    },
  ];
}

// Helper to convert Result monad to Promise for React Query
function wrapResultToPromise<T>(pro: () => Promise<Result<T>>, label: string) {
  return async (): Promise<T> => {
    const res = await pro();
    if (res.isOk()) {
      return res.Ok();
    }
    const error = res.Err();
    console.error(`[Fireproof Dashboard] ❌ Error for ${label}:`, error);
    throw error;
  };
}

export default function FireproofDashboard() {
  const { isSignedIn, isLoaded, getToken, userId } = useAuth();

  // Create DashboardApi instance with Clerk auth
  const api = useMemo(() => {
    const apiUrl = VibesDiyEnv.CONNECT_API_URL();
    return new DashboardApi({
      apiUrl,
      fetch: fetch, // Use global fetch
      getToken: async () => {
        const token = await getToken({ template: "with-email" });
        return {
          type: "clerk",
          token: token || "",
        };
      },
    });
  }, [getToken]);

  // Query to ensure the user exists and is active
  const ensureUserQuery = useQuery<ResEnsureUser>({
    queryKey: ["ensureUser", userId],
    queryFn: wrapResultToPromise(() => api.ensureUser({}), "ensureUser"),
    enabled: isLoaded && isSignedIn,
  });

  // Loading state while Clerk initializes
  if (!isLoaded) {
    return (
      <SimpleAppLayout
        headerLeft={
          <div className="flex items-center">
            <a
              href="/"
              className="text-light-primary dark:text-dark-primary hover:text-accent-02-light dark:hover:text-accent-02-dark flex items-center px-3 py-2"
              aria-label="Go to home"
            >
              <HomeIcon className="h-6 w-6" />
            </a>
          </div>
        }
      >
        <div className="mx-auto max-w-4xl px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Fireproof Dashboard</h1>
          <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-sm border p-6">
            <p className="text-light-secondary dark:text-dark-secondary">
              Loading...
            </p>
          </div>
        </div>
      </SimpleAppLayout>
    );
  }

  // Not authenticated view
  if (!isSignedIn) {
    return (
      <SimpleAppLayout
        headerLeft={
          <div className="flex items-center">
            <a
              href="/"
              className="text-light-primary dark:text-dark-primary hover:text-accent-02-light dark:hover:text-accent-02-dark flex items-center px-3 py-2"
              aria-label="Go to home"
            >
              <HomeIcon className="h-6 w-6" />
            </a>
          </div>
        }
      >
        <div className="mx-auto max-w-4xl px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Fireproof Dashboard</h1>
          <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-sm border p-6">
            <p className="text-light-secondary dark:text-dark-secondary">
              Please sign in to view your Fireproof dashboard.
            </p>
          </div>
        </div>
      </SimpleAppLayout>
    );
  }

  return (
    <SimpleAppLayout
      headerLeft={
        <div className="flex items-center">
          <a
            href="/"
            className="text-light-primary dark:text-dark-primary hover:text-accent-02-light dark:hover:text-accent-02-dark flex items-center px-3 py-2"
            aria-label="Go to home"
          >
            <HomeIcon className="h-6 w-6" />
          </a>
        </div>
      }
    >
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Fireproof Dashboard</h1>
        <div className="space-y-8">
          {ensureUserQuery.isLoading && (
            <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-sm border p-6">
              <p className="text-light-secondary dark:text-dark-secondary">
                Ensuring user presence...
              </p>
            </div>
          )}
          {ensureUserQuery.isError && (
            <div className="border-red-500 rounded-sm border p-6 bg-red-50 dark:bg-red-900/20">
              <p className="text-red-700 dark:text-red-300">
                Error ensuring user:{" "}
                {ensureUserQuery.error instanceof Error
                  ? ensureUserQuery.error.message
                  : "Unknown error"}
              </p>
            </div>
          )}
          {ensureUserQuery.isSuccess && ensureUserQuery.data?.user && (
            <div className="border-green-500 rounded-sm border p-6 bg-green-50 dark:bg-green-900/20">
              <p className="text-green-700 dark:text-green-300">
                User <b>{ensureUserQuery.data.user.userId}</b> is active.
              </p>
            </div>
          )}
        </div>
      </div>
    </SimpleAppLayout>
  );
}
