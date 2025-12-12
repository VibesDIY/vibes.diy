import React, { createContext, useContext, ReactNode } from "react";
import { useClerk } from "@clerk/clerk-react";
import { clerkDashApi } from "@fireproof/core-protocols-dashboard";
import type { DashboardApiImpl } from "@fireproof/core-protocols-dashboard";
import type { Clerk } from "@clerk/shared/types";
import { VibesDiyEnv } from "../config/env.js";

// Minimal Clerk interface matching the contract required by clerkDashApi
interface ClerkWithListener {
  addListener: (
    callback: (resources: {
      session: {
        getToken: (options?: unknown) => Promise<string | null>;
      } | null;
    }) => void,
  ) => () => void;
}

interface DashboardContextType {
  dashApi: DashboardApiImpl<unknown>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined,
);

export function DashboardProvider({ children }: { children: ReactNode }) {
  // Type assertion chain: first to our minimal contract (ClerkWithListener), then to
  // the Clerk type expected by clerkDashApi. This bridges version differences between
  // @clerk/clerk-react and @clerk/shared/types while documenting the actual contract.
  const clerk = useClerk() as ClerkWithListener as Clerk;

  const dashApi = clerkDashApi(clerk, {
    apiUrl: VibesDiyEnv.CONNECT_API_URL(),
  });

  return (
    <DashboardContext.Provider value={{ dashApi }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
