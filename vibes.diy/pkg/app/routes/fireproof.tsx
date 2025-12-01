import React from "react";
import { useSession } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardApi } from "../lib/dashboard-api.js";
import { VibesDiyEnv } from "../config/env.js";
import SimpleAppLayout from "../components/SimpleAppLayout.js";

export default function FireproofRoute() {
  const { session, isLoaded, isSignedIn } = useSession();

  const api = new DashboardApi({
    apiUrl: VibesDiyEnv.CONNECT_API_URL(),
    fetch: window.fetch.bind(window),
    getToken: async () => {
      if (!session) return null;
      const token = await session.getToken({ template: "with-email" });
      return {
        type: "clerk",
        token: token || "",
      };
    },
  });

  const tenantsQuery = useQuery({
    queryKey: ["fireproof", "tenants", session?.user?.id],
    queryFn: async () => {
      const res = await api.listTenantsByUser({});
      if (res.isErr()) {
        const e = res.Err();
        throw e instanceof Error
          ? e
          : new Error(String(e) || "Failed to list tenants");
      }
      return res.Ok();
    },
    enabled: isLoaded && isSignedIn && !!session,
  });

  const ledgersQuery = useQuery({
    queryKey: ["fireproof", "ledgers", session?.user?.id],
    queryFn: async () => {
      const res = await api.listLedgersByUser({});
      if (res.isErr()) {
        const e = res.Err();
        throw e instanceof Error
          ? e
          : new Error(String(e) || "Failed to list ledgers");
      }
      return res.Ok();
    },
    enabled: isLoaded && isSignedIn && !!session,
  });

  if (!isLoaded)
    return (
      <SimpleAppLayout>
        <div>Loading session...</div>
      </SimpleAppLayout>
    );
  if (!isSignedIn)
    return (
      <SimpleAppLayout>
        <div>Please sign in to view Fireproof data.</div>
      </SimpleAppLayout>
    );

  return (
    <SimpleAppLayout>
      <div className="container mx-auto p-4 space-y-8">
        <h1 className="text-2xl font-bold">Fireproof Dashboard (PoC)</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border p-4 rounded shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Tenants</h2>
            {tenantsQuery.isLoading && <div>Loading tenants...</div>}
            {tenantsQuery.isError && (
              <div className="text-red-500">
                Error: {tenantsQuery.error.message}
              </div>
            )}
            {tenantsQuery.data && (
              <ul className="space-y-2">
                {tenantsQuery.data.tenants.length === 0 ? (
                  <li className="text-gray-500">No tenants found.</li>
                ) : (
                  tenantsQuery.data.tenants.map((t) => (
                    <li key={t.tenantId} className="border-b pb-2">
                      <div className="font-medium">
                        {t.tenant.name || "Unnamed Tenant"}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {t.tenantId}
                      </div>
                      <div className="text-xs text-gray-500">
                        Role: {t.role}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          <div className="border p-4 rounded shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Ledgers</h2>
            {ledgersQuery.isLoading && <div>Loading ledgers...</div>}
            {ledgersQuery.isError && (
              <div className="text-red-500">
                Error: {ledgersQuery.error.message}
              </div>
            )}
            {ledgersQuery.data && (
              <ul className="space-y-2">
                {ledgersQuery.data.ledgers.length === 0 ? (
                  <li className="text-gray-500">No ledgers found.</li>
                ) : (
                  ledgersQuery.data.ledgers.map((l) => (
                    <li key={l.ledgerId} className="border-b pb-2">
                      <div className="font-medium">
                        {l.name || "Unnamed Ledger"}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {l.ledgerId}
                      </div>
                      <div className="text-xs text-gray-500">
                        Tenant ID: {l.tenantId}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded text-sm">
          <h3 className="font-semibold mb-2">Debug Info</h3>
          <p>API URL: {VibesDiyEnv.CONNECT_API_URL()}</p>
          <p>User ID: {session.user.id}</p>
        </div>
      </div>
    </SimpleAppLayout>
  );
}
