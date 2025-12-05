import React, { useEffect, useState, type ReactNode } from "react";
import { useClerk, useSession } from "@clerk/clerk-react";
import {
  clerkDashApi,
  type DashboardApiImpl,
} from "@fireproof/core-protocols-dashboard";
import { DashboardApiContext } from "../contexts/DashboardApiContext.js";

/**
 * VibeClerkIntegration - Provider component that sets up Clerk + DashboardApi
 * Wraps children and provides dashApi instance via context
 * When dashApi is present, useFireproof will automatically enable cloud sync
 *
 * IMPORTANT: This component REQUIRES ClerkProvider to be in the component tree.
 * It will throw an error if used outside of ClerkProvider.
 * For apps that don't use Clerk, simply don't use this component.
 */
export function VibeClerkIntegration({ children }: { children: ReactNode }) {
  const { session, isLoaded } = useSession();
  const clerk = useClerk();
  const [dashApi, setDashApi] = useState<DashboardApiImpl<unknown> | null>(
    null,
  );

  useEffect(() => {
    // Wait for Clerk to be fully loaded before creating dashApi
    if (isLoaded && session && clerk) {
      const apiUrl = "https://connect.fireproof.direct/fp/cloud/api";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = clerkDashApi(clerk as any, { apiUrl });
      setDashApi(api);
    }
  }, [isLoaded, session, clerk]);

  return (
    <DashboardApiContext.Provider value={dashApi}>
      {children}
    </DashboardApiContext.Provider>
  );
}
