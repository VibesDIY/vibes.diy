import { createContext, useContext } from "react";
import type { DashboardApiImpl } from "@fireproof/core-protocols-dashboard";

// DashboardApi Context for Clerk integration
export const DashboardApiContext =
  createContext<DashboardApiImpl<unknown> | null>(null);

export function useDashboardApi() {
  return useContext(DashboardApiContext);
}
