import React, { useMemo, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardApi } from "@fireproof/core-protocols-dashboard";
import type {
  ResListTenantsByUser,
  ResListLedgersByUser,
  UserTenant,
  LedgerUser,
} from "@fireproof/core-protocols-dashboard";
import type { Result } from "@adviser/cement";
import { decodeJwt } from "jose";
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
    console.log(`[Fireproof Dashboard] 🚀 Starting API call: ${label}`);
    const res = await pro();
    if (res.isOk()) {
      const data = res.Ok();
      console.log(`[Fireproof Dashboard] ✅ Success for ${label}:`, data);
      return data;
    }
    const error = res.Err();
    console.error(`[Fireproof Dashboard] ❌ Error for ${label}:`, error);

    // Enhance error message for JWKS verification failure
    if (
      error instanceof Error &&
      error.message.includes("No well-known JWKS URL could verify the token")
    ) {
      const improvedError = new Error(
        `Authentication failed: The Fireproof backend could not verify your token. This usually happens when using a development Clerk instance with the production Fireproof backend. Please set VITE_CONNECT_API_URL to a compatible development backend.`,
      );
      improvedError.stack = error.stack;
      throw improvedError;
    }

    throw error;
  };
}

export default function FireproofDashboard() {
  const { isSignedIn, isLoaded, getToken } = useAuth();

  const [fpCloudToken, setFpCloudToken] = useState<string | null>(null); // Moved useState here

  // Create DashboardApi instance with Clerk auth
  const api = useMemo(() => {
    const apiUrl = VibesDiyEnv.CONNECT_API_URL();
    console.log(
      "[Fireproof Dashboard] 🔧 Creating DashboardApi instance with URL:",
      apiUrl,
    );
    return new DashboardApi({
      apiUrl,
      fetch: window.fetch.bind(window),
      getToken: async () => {
        if (fpCloudToken) {
          console.log("[Fireproof Dashboard] 🔑 Using existing fp-cloud-jwt.");
          return {
            type: "ucan" as const, // Corrected type here
            token: fpCloudToken,
          };
        }

        console.log(
          "[Fireproof Dashboard] 🔑 Getting Clerk token with template: with-email",
        );
        const token = await getToken({ template: "with-email" });

        if (token) {
          try {
            const claims = decodeJwt(token);
            const now = Date.now() / 1000;
            const exp = claims.exp || 0;
            const ttl = exp - now;

            console.log("[Fireproof Dashboard] 🕵️‍♀️ Token Claims:", {
              iss: claims.iss,
              exp: claims.exp,
              iat: claims.iat,
              ttl: ttl.toFixed(2) + "s",
            });

            if (exp < now) {
              console.error(
                "/[Fireproof Dashboard] ❌ Token is EXPIRED! Client clock may be wrong or Clerk returned old token.",
              );
            }
          } catch (e) {
            console.error("[Fireproof Dashboard] ⚠️ Failed to parse token:", e);
          }
        }

        console.log(
          "/[Fireproof Dashboard] 🎫 Token retrieved:",
          token ? `${token.substring(0, 20)}...` : "null",
        );
        return {
          type: "clerk" as const,
          token: token || "",
        };
      },
    });
  }, [getToken, fpCloudToken]);

  useEffect(() => { // Moved useEffect here
    if (!isLoaded || !isSignedIn || fpCloudToken) return;

    const fetchFpCloudToken = async () => {
      console.log("[Fireproof Dashboard] 🚀 Attempting to get fp-cloud-jwt...");
      try {
        const result = await api.getCloudSessionToken({});
        if (result.isOk()) {
          setFpCloudToken(result.Ok().token);
          console.log("[Fireproof Dashboard] ✅ Successfully retrieved fp-cloud-jwt.");
        } else {
          console.error("[Fireproof Dashboard] ❌ Error getting fp-cloud-jwt:", result.Err());
        }
      } catch (e) {
        console.error("[Fireproof Dashboard] ❌ Exception getting fp-cloud-jwt:", e);
      }
    };

    fetchFpCloudToken();
  }, [isLoaded, isSignedIn, fpCloudToken, api]);


  // Query to list all tenants for the logged-in user
  const tenantsQuery = useQuery<ResListTenantsByUser>({
    queryKey: ["listTenantsByUser"],
    queryFn: wrapResultToPromise(
      () => api.listTenantsByUser({}),
      "listTenantsByUser",
    ),
    enabled: isLoaded && isSignedIn,
  });

  // Query to list all ledgers for the logged-in user
  const ledgersQuery = useQuery<ResListLedgersByUser>({
    queryKey: ["listLedgersByUser"],
    queryFn: wrapResultToPromise(
      () => api.listLedgersByUser({}),
      "listLedgersByUser",
    ),
    enabled: isLoaded && isSignedIn,
  });

  // Log authentication and query states
  useEffect(() => {
    console.log("[Fireproof Dashboard] 📊 State Update:", {
      isLoaded,
      isSignedIn,
      tenantsQuery: {
        isLoading: tenantsQuery.isLoading,
        isError: tenantsQuery.isError,
        isSuccess: tenantsQuery.isSuccess,
        dataCount: tenantsQuery.data?.tenants.length,
      },
      ledgersQuery: {
        isLoading: ledgersQuery.isLoading,
        isError: ledgersQuery.isError,
        isSuccess: ledgersQuery.isSuccess,
        dataCount: ledgersQuery.data?.ledgers.length,
      },
    });
  }, [
    isLoaded,
    isSignedIn,
    tenantsQuery.isLoading,
    tenantsQuery.isError,
    tenantsQuery.isSuccess,
    tenantsQuery.data,
    ledgersQuery.isLoading,
    ledgersQuery.isError,
    ledgersQuery.isSuccess,
    ledgersQuery.data,
  ]);

  // Not authenticated view
  if (isLoaded && !isSignedIn) {
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
              Please sign in to view your Fireproof tenants and ledgers.
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
          {/* Tenants Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Tenants</h2>
            {tenantsQuery.isLoading && (
              <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-sm border p-6">
                <p className="text-light-secondary dark:text-dark-secondary">
                  Loading tenants...
                </p>
              </div>
            )}
            {tenantsQuery.isError && (
              <div className="border-red-500 rounded-sm border p-6 bg-red-50 dark:bg-red-900/20">
                <p className="text-red-700 dark:text-red-300">
                  Error loading tenants:{" "}
                  {tenantsQuery.error instanceof Error
                    ? tenantsQuery.error.message
                    : "Unknown error"}
                </p>
              </div>
            )}
            {tenantsQuery.isSuccess && (
              <div className="space-y-3">
                {tenantsQuery.data.tenants.length === 0 ? (
                  <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-sm border p-6">
                    <p className="text-light-secondary dark:text-dark-secondary">
                      No tenants found.
                    </p>
                  </div>
                ) : (
                  tenantsQuery.data.tenants.map((tenant: UserTenant) => (
                    <div
                      key={tenant.tenantId}
                      className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-sm border p-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-light-primary dark:text-dark-primary">
                            {tenant.tenant.name || "Unnamed Tenant"}
                          </h3>
                          <p className="text-sm text-light-secondary dark:text-dark-secondary font-mono">
                            ID: {tenant.tenantId}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              tenant.role === "admin"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                            }`}
                          >
                            {tenant.role}
                          </span>
                          {tenant.default && (
                            <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              default
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-light-secondary dark:text-dark-secondary">
                        <p>Status: {tenant.tenant.status}</p>
                        <p>
                          Created:{" "}
                          {new Date(
                            tenant.tenant.createdAt,
                          ).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Ledgers Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Ledgers</h2>
            {ledgersQuery.isLoading && (
              <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-sm border p-6">
                <p className="text-light-secondary dark:text-dark-secondary">
                  Loading ledgers...
                </p>
              </div>
            )}
            {ledgersQuery.isError && (
              <div className="border-red-500 rounded-sm border p-6 bg-red-50 dark:bg-red-900/20">
                <p className="text-red-700 dark:text-red-300">
                  Error loading ledgers:{" "}
                  {ledgersQuery.error instanceof Error
                    ? ledgersQuery.error.message
                    : "Unknown error"}
                </p>
              </div>
            )}
            {ledgersQuery.isSuccess && (
              <div className="space-y-3">
                {ledgersQuery.data.ledgers.length === 0 ? (
                  <div className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-sm border p-6">
                    <p className="text-light-secondary dark:text-dark-secondary">
                      No ledgers found.
                    </p>
                  </div>
                ) : (
                  ledgersQuery.data.ledgers.map((ledger: LedgerUser) => (
                    <div
                      key={ledger.ledgerId}
                      className="border-light-decorative-01 dark:border-dark-decorative-01 rounded-sm border p-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-light-primary dark:text-dark-primary">
                            {ledger.name}
                          </h3>
                          <p className="text-sm text-light-secondary dark:text-dark-secondary font-mono">
                            ID: {ledger.ledgerId}
                          </p>
                          <p className="text-sm text-light-secondary dark:text-dark-secondary font-mono">
                            Tenant: {ledger.tenantId}
                          </p>
                        </div>
                        <div
                          className="text-sm text-light-secondary dark:text-dark-secondary"
                        >
                          <p>Users: {ledger.users.length}</p>
                          <p>Max shares: {ledger.maxShares}</p>
                        </div>
                      </div>
                      <div
                        className="mt-2 text-sm text-light-secondary dark:text-dark-secondary"
                      >
                        <p>
                          Created:{" "}
                          {new Date(ledger.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {ledger.users.length > 0 && (
                        <div
                          className="mt-3 pt-3 border-t border-light-decorative-01 dark:border-dark-decorative-01"
                        >
                          <p
                            className="text-xs font-medium text-light-secondary dark:text-dark-secondary mb-2"
                          >
                            User Access:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {ledger.users.map((user, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800 text-light-secondary dark:text-dark-secondary"
                              >
                                {user.name || user.userId} ({user.role}/
                                {user.right})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </SimpleAppLayout>
  );
}