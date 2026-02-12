import { ExecutionContext } from "@cloudflare/workers-types";

export interface CFCloudflareContext {
  readonly env: {
    CLERK_PUBLISHABLE_KEY: string;
  };
  readonly ctx: ExecutionContext;
}
