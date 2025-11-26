import React, { useMemo } from "react";
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
function wrapResultToPromise<T>(pro: () => Promise<Result<T>>) {
  return async (): Promise<T> => {
    const res = await pro();
    if (res.isOk()) {
      return res.Ok();
    }
    throw res.Err();
  };
}

export default function FireproofDashboard() {
  const { isSignedIn, isLoaded, getToken } = useAuth();

  // Create DashboardApi instance with Clerk auth
  const api = useMemo(() => {
    return new DashboardApi({
      apiUrl: VibesDiyEnv.CONNECT_API_URL(),
      fetch: window.fetch.bind(window),
      getToken: async () => {
        const token = await getToken({ template: "with-email" });
        return {
          type: "clerk" as const,
          token: token || "",
        };
      },
    });
  }, [getToken]);

  // Query to list all tenants for the logged-in user
  const tenantsQuery = useQuery<ResListTenantsByUser>({
    queryKey: ["listTenantsByUser"],
    queryFn: wrapResultToPromise(() => api.listTenantsByUser({})),
    enabled: isLoaded && isSignedIn,
  });

  // Query to list all ledgers for the logged-in user
  const ledgersQuery = useQuery<ResListLedgersByUser>({
    queryKey: ["listLedgersByUser"],
    queryFn: wrapResultToPromise(() => api.listLedgersByUser({})),
    enabled: isLoaded && isSignedIn,
  });

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
                        <div className="text-sm text-light-secondary dark:text-dark-secondary">
                          <p>Users: {ledger.users.length}</p>
                          <p>Max shares: {ledger.maxShares}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-light-secondary dark:text-dark-secondary">
                        <p>
                          Created:{" "}
                          {new Date(ledger.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {ledger.users.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-light-decorative-01 dark:border-dark-decorative-01">
                          <p className="text-xs font-medium text-light-secondary dark:text-dark-secondary mb-2">
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
