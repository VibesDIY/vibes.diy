import React, { createContext, useContext, ReactNode } from "react";
import { useClerk } from "@clerk/clerk-react";
import { clerkDashApi } from "@fireproof/core-protocols-dashboard";
import type { DashboardApiImpl } from "@fireproof/core-protocols-dashboard";
import { VibesDiyEnv } from "../config/env.js";

interface DashboardContextType {
  dashApi: DashboardApiImpl<unknown>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined,
);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const clerk = useClerk();

  // Type assertion needed due to version mismatch between @clerk/clerk-react and
  // @clerk/clerk-js in @fireproof/core-protocols-dashboard transitive dependency.
  // Runtime: Both have compatible addListener interface that clerkDashApi requires.
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
